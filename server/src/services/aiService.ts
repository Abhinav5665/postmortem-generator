import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { ParsedLogsResult } from './logParser'
import { TimelineEvent } from './timelineBuilder'
import { SeverityResult } from './severityScorer'



const ActionItemSchema = z.object({
  task: z.string(),
  owner: z.string(),
  dueDate: z.literal('Not specified'), // AI never invents due dates
  completed: z.boolean().default(false),
})

// Severity removed entirely — application owns it, not Gemini
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
  templateType: string = 'General'
): Promise<PostmortemResult> {

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

console.log('Gemini key loaded:', !!process.env.GEMINI_API_KEY)
console.log('Gemini model:', process.env.GEMINI_MODEL)

  const timelineText = timeline
    .map(event => {
      const time = event.time
        ? event.time.toString().replace('T', ' ').substring(0, 19)
        : 'Unknown time'
      return `${time} - [${event.type}] ${event.event}`
    })
    .join('\n')

  const logsText = selectImportantLogs(parsedLogs)

  const teamInfo = teamMembers && teamMembers.length > 0
  ? teamMembers.map(m => `- ${m.name} (${m.role})`).join('\n')
  : 'Not specified'


  const templateInstructions: Record<string, string> = {
  General: ` GENERAL TEMPLATE: - Analyze the incident using the available logs, timeline, and engineer notes - Focus on the most important facts, root cause, impact, resolution, and prevention - Do not assume details that are not supported by the available evidence `.trim(),
  Deployment: `
DEPLOYMENT TEMPLATE FOCUS: - Identify what was deployed or changed, if supported by the logs or engineer notes - Determine whether the deployment or configuration change is connected to the incident - Describe the deployment timeline and any rollback or recovery steps taken - Suggest deployment or release-process improvements directly related to the incident - Do not assume a deployment caused the incident without supporting evidence `.trim(),
  Database: `
DATABASE TEMPLATE FOCUS: - Identify the database, table, query, or database operation involved, if supported by the evidence - Analyze connection, connection-pool, replication, locking, timeout, or schema issues when present - Describe how database availability or performance affected the service - Suggest database monitoring, reliability, or optimization improvements directly related to the incident - Do not invent database names, tables, queries, or schema changes `.trim(),
  Security: `
SECURITY TEMPLATE FOCUS: - Describe how the security issue was discovered, if supported by the evidence - Identify potentially affected systems or data only when supported by the logs or engineer notes - Explain the scope and potential blast radius based only on available evidence - Describe containment, remediation, or recovery steps that were actually taken - Suggest security hardening measures directly related to the incident - Do not claim a breach, exposure, or compromised data without supporting evidence `.trim(),
  Performance: `
PERFORMANCE TEMPLATE FOCUS: - Identify the specific performance issue, such as latency, CPU, memory, throughput, or resource exhaustion, if supported by the evidence - Determine what triggered or contributed to the performance degradation - Describe how performance affected users or system behavior based only on available evidence - Identify relevant bottlenecks or resource constraints when supported by the logs or notes - Suggest monitoring, capacity, or optimization improvements directly related to the incident - Do not invent performance metrics or bottlenecks `.trim(),
  Infrastructure: `
INFRASTRUCTURE TEMPLATE FOCUS: - Identify the affected infrastructure, such as servers, networking, DNS, cloud services, containers, or load balancers, if supported by the evidence - Explain the infrastructure failure mode based on the available logs and notes - Describe the recovery or failover steps that were actually taken - Explain the impact on the affected service based only on available evidence - Suggest infrastructure resilience, monitoring, or redundancy improvements directly related to the incident - Do not invent infrastructure components, failures, or recovery actions `.trim(),
}

const templateFocus = templateInstructions[templateType] || ''

  

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

${templateFocus ? `\nTEMPLATE FOCUS (${templateType} incident):\n${templateFocus}\n` : ''}

INCIDENT DETAILS:
Service: ${serviceName}
Duration: ${durationMinutes} minutes
Start: ${startTime.toISOString()}
End: ${endTime.toISOString()}
Severity (system determined): ${severityResult.level} — ${severityResult.reasoning}

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
    "affectedUsers": "Only if determinable from logs or notes, otherwise Unknown",
    "failureRate": "Only if determinable from logs or notes, otherwise Unknown",
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

  // Gemini call — JSON.parse and Zod errors bubble up to the route handler
  const result = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt,
  })

  const text = result.text || ''

  // Clean response — strip markdown backticks if Gemini adds them
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const rawParsed = JSON.parse(cleaned)
  const validated = PostmortemSchema.parse(rawParsed)

  // Application owns severity — not Gemini
  return {
    ...validated,
    severity: severityResult.level,
  }
}