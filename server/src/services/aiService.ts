import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { ParsedLogsResult } from './logParser'
import { TimelineEvent } from './timelineBuilder'
import { SeverityResult } from './severityScorer'

const ActionItemSchema = z.object({
  task: z.string(),
  owner: z.string(),
  // AI never invents due dates: accept anything, always store "Not specified"
  dueDate: z
    .string()
    .default('Not specified')
    .transform(() => 'Not specified' as const),
  completed: z.boolean().default(false),
})

// Severity removed entirely: application owns it, not the AI
const PostmortemSchema = z.object({
  summary: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  impactMetrics: z.object({
    affectedUsers: z.string(),
    failureRate: z.string(),
    downtime: z.string(),
  }),
  resolution: z.string(),
  wentWell: z.string(),
  actionItems: z.array(ActionItemSchema),
})

export type PostmortemResult = z.infer<typeof PostmortemSchema> & {
  severity: 'P0' | 'P1' | 'P2'
}

function selectImportantLogs(parsedLogs: ParsedLogsResult, limit = 50): string {
  const fatal   = parsedLogs.logs.filter(l => l.level === 'FATAL')
  const errors  = parsedLogs.logs.filter(l => l.level === 'ERROR')
  const warns   = parsedLogs.logs.filter(l => l.level === 'WARN')
  const unknown = parsedLogs.logs.filter(l => l.level === 'UNKNOWN')

  const selected = [
    ...fatal,
    ...errors,
    ...warns,
    ...unknown,
  ].slice(0, limit)

  return selected.map(log => log.raw).join('\n')
}

const templateInstructions: Record<string, string> = {
  General: `GENERAL TEMPLATE:
- Analyze the incident using the available logs, timeline, and engineer notes
- Focus on the most important facts, root cause, impact, resolution, and prevention
- Do not assume details that are not supported by the available evidence`,

  Deployment: `DEPLOYMENT TEMPLATE FOCUS:
- Identify what was deployed or changed, if supported by the logs or engineer notes
- Determine whether the deployment or configuration change is connected to the incident
- Describe the deployment timeline and any rollback or recovery steps taken
- Suggest deployment or release-process improvements directly related to the incident
- Do not assume a deployment caused the incident without supporting evidence`,

  Database: `DATABASE TEMPLATE FOCUS:
- Identify the database, table, query, or database operation involved, if supported by the evidence
- Analyze connection, connection-pool, replication, locking, timeout, or schema issues when present
- Describe how database availability or performance affected the service
- Suggest database monitoring, reliability, or optimization improvements directly related to the incident
- Do not invent database names, tables, queries, or schema changes`,

  Security: `SECURITY TEMPLATE FOCUS:
- Describe how the security issue was discovered, if supported by the evidence
- Identify potentially affected systems or data only when supported by the logs or engineer notes
- Explain the scope and potential blast radius based only on available evidence
- Describe containment, remediation, or recovery steps that were actually taken
- Suggest security hardening measures directly related to the incident
- Do not claim a breach, exposure, or compromised data without supporting evidence
- Never state that nothing was accessed or exposed. Say that no evidence was found, and only if the engineer notes say so`,


  Performance: `PERFORMANCE TEMPLATE FOCUS:
- Identify the specific performance issue, such as latency, CPU, memory, throughput, or resource exhaustion, if supported by the evidence
- Determine what triggered or contributed to the performance degradation
- Describe how performance affected users or system behavior based only on available evidence
- Identify relevant bottlenecks or resource constraints when supported by the logs or notes
- Suggest monitoring, capacity, or optimization improvements directly related to the incident
- Do not invent performance metrics or bottlenecks`,

  Infrastructure: `INFRASTRUCTURE TEMPLATE FOCUS:
- Identify the affected infrastructure, such as servers, networking, DNS, cloud services, containers, or load balancers, if supported by the evidence
- Explain the infrastructure failure mode based on the available logs and notes
- Describe the recovery or failover steps that were actually taken
- Explain the impact on the affected service based only on available evidence
- Suggest infrastructure resilience, monitoring, or redundancy improvements directly related to the incident
- Do not invent infrastructure components, failures, or recovery actions`,
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Temporary provider errors worth retrying
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return status === 429 || status === 500 || status === 503 || status === 504
}

// Last-resort fallback: OpenRouter (OpenAI-compatible API)
async function generateWithOpenRouter(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const models = (process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || '')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean)
  if (!apiKey || models.length === 0) throw new Error('OpenRouter is not configured')

  let lastErr: unknown
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 8000,
        }),
        signal: AbortSignal.timeout(90_000),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`OpenRouter ${model} failed:`, res.status, body.slice(0, 200))
        const err = new Error(`OpenRouter ${model}: ${res.status}`) as Error & { status?: number }
        err.status = res.status
        throw err
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[]
      }
      const content = data.choices?.[0]?.message?.content
      if (content) return content
      throw new Error(`OpenRouter ${model}: empty response`)
    } catch (err) {
       console.warn(`OpenRouter ${model} error:`, (err as Error).message)
      lastErr = err
    }
  }
  throw lastErr
}

// Two tries on the primary Gemini model, one on the fallback Gemini model,
// then OpenRouter if configured. Non-retryable errors (bad key, bad request)
// are thrown immediately.
async function generateWithRetry(ai: GoogleGenAI, prompt: string): Promise<string> {
  const primary = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const fallback = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash'
  const models = [primary, primary, fallback]

  let lastErr: unknown
  for (let i = 0; i < models.length; i++) {
    try {
      const result = await ai.models.generateContent({
        model: models[i],
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })
      return result.text || ''
    } catch (err) {
       console.warn(
    `Gemini attempt ${i + 1} failed:`,
    (err as { status?: number })?.status,
    String((err as Error)?.message).slice(0, 200)
  )
      lastErr = err
      if (!isRetryable(err)) throw err
      if (i < models.length - 1) await sleep(1500 * 2 ** i)
    }
  }

  // Gemini is busy or down: try OpenRouter if it is configured
  if (process.env.OPENROUTER_API_KEY && (process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL)) {
    console.warn('Gemini unavailable, falling back to OpenRouter')
    return generateWithOpenRouter(prompt)
  }

  throw lastErr
}

export async function generatePostmortem(
  serviceName: string,
  startTime: Date,
  endTime: Date,
  durationMinutes: number,
  parsedLogs: ParsedLogsResult,
  timeline: TimelineEvent[],
  engineerNotes: string,
  severityResult: SeverityResult,
  teamMembers?: { name: string; role: string }[],
  templateType: string = 'General',
  reportedImpact?: {
    affectedUsers: number
    serviceUnavailable: boolean
    confirmedCompromise: boolean
    dataBreach: boolean
  }
): Promise<PostmortemResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

  const timelineText = timeline
    .map(event => {
      const time = event.time
        ? event.time.toString().replace('T', ' ').substring(0, 19)
        : 'Unknown time'
      return `${time} - [${event.type}] ${event.event}`
    })
    .join('\n')

  const logsText = selectImportantLogs(parsedLogs)

  const teamInfo =
    teamMembers && teamMembers.length > 0
      ? teamMembers.map(m => `- ${m.name} (${m.role})`).join('\n')
      : 'Not specified'

  const templateFocus = templateInstructions[templateType] || ''

  const impactLines = reportedImpact
    ? [
        reportedImpact.affectedUsers > 0 ? `- Affected users: ${reportedImpact.affectedUsers}` : null,
        reportedImpact.serviceUnavailable ? '- Service was fully unavailable' : null,
        reportedImpact.confirmedCompromise ? '- Confirmed security compromise' : null,
        reportedImpact.dataBreach ? '- Confirmed data breach' : null,
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  const prompt = `
You are a senior site reliability engineer writing a professional postmortem document.

Analyze the incident data below and generate a complete, specific postmortem.
Be specific — use actual error messages, service names, and timestamps from the logs.
Do NOT be generic. If you see a database timeout in the logs, say that specifically.

CRITICAL RULES:
- Never invent metrics, user counts, failure rates, root causes, or any data not supported by the evidence
- If something cannot be determined from the logs or notes, return "Not specified"
- Clearly distinguish observed facts from reasonable inferences
- Only suggest action items directly relevant to what actually happened
- Do NOT include a severity field
- Do NOT invent due dates — always return "Not specified" for dueDate
- For wentWell — only write what is directly supported by the logs or engineer notes. If there is no evidence of what went well, return "Not specified"
- Use the engineer-reported impact exactly as given. Never contradict it.
- If the logs show a long gap between the first error and the first alert, include one action item about faster detection. Only state times that appear in the logs.
- Write times in plain form such as "20:00 UTC", never as ISO strings with milliseconds
- If the incident was declared long after the first error, include one action item about faster escalation, using exact times from the logs
- Never state that nothing was accessed or exposed. Say that no evidence was found, and only if the engineer notes say so
- When stating how long something took or how large a gap was, calculate it from the log timestamps, not from durations written inside log messages
- If a time in the engineer notes is approximate ("about", "around"), keep it approximate. Never present it as an exact time
- Do not say something happened automatically or without manual intervention unless the logs or notes say so

${templateFocus ? `\nTEMPLATE FOCUS (${templateType} incident):\n${templateFocus}\n` : ''}

INCIDENT DETAILS:
Service: ${serviceName}
Duration: ${durationMinutes} minutes
Start: ${startTime.toISOString().substring(0, 16).replace('T', ' ')} UTC
End: ${endTime.toISOString().substring(0, 16).replace('T', ' ')} UTC
Severity (system determined): ${severityResult.level} — ${severityResult.reasoning}
${impactLines ? `\nENGINEER-REPORTED IMPACT (treat as confirmed fact):\n${impactLines}\n` : ''}

TEAM:
${teamInfo}

ERROR LOGS (FATAL and ERROR prioritized):
${logsText || 'No structured logs provided'}

TIMELINE:
${timelineText}

ENGINEER NOTES:
${engineerNotes}

LOG STATISTICS:
- Total log lines: ${parsedLogs.totalLines}
- Fatal errors: ${parsedLogs.fatalCount}
- Errors: ${parsedLogs.errorCount}
- Warnings: ${parsedLogs.warnCount}

Respond ONLY with a valid JSON object, no extra text, no markdown, no backticks.
Use this exact structure:
{
  "summary": "One clear paragraph describing what happened, when, and how it was resolved",
  "rootCause": "Specific root cause from logs and notes, or Not specified if unclear",
  "impact": "What broke, who was affected, and for how long based only on available data",
  "impactMetrics": {
    "affectedUsers": "Only if determinable from logs or notes, otherwise Not specified",
    "failureRate": "Short value only, such as 30%, if determinable from logs or notes, otherwise Not specified",
    "downtime": "${durationMinutes} minutes"
  },
  "resolution": "How the incident was resolved based on engineer notes and logs, or Not specified",
  "wentWell": "Only what is directly evidenced by the logs or notes, or Not specified",
  "actionItems": [
    {
      "task": "Specific preventive action directly related to the root cause",
      "owner": "Team or person responsible, use participant names if available",
      "dueDate": "Not specified",
      "completed": false
    }
  ]
}
`

  // AI call with retry and fallbacks. JSON.parse and Zod errors bubble up to the route handler
  const text = await generateWithRetry(ai, prompt)

  // Strip markdown fences if present, then extract the outermost JSON object
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  const jsonText =
    jsonStart !== -1 && jsonEnd > jsonStart
      ? cleaned.slice(jsonStart, jsonEnd + 1)
      : cleaned

  const rawParsed = JSON.parse(jsonText)
  const validated = PostmortemSchema.parse(rawParsed)

  // Application owns severity, not the AI
  return {
    ...validated,
    severity: severityResult.level,
  }
}