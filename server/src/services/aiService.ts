import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { ParsedLogsResult } from './logParser'
import { TimelineEvent } from './timelineBuilder'
import { SeverityResult } from './severityScorer'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })

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
  onCallEngineer?: string,
  incidentCommander?: string,
  participants?: string[]
): Promise<PostmortemResult> {

  const timelineText = timeline
    .map(event => {
      const time = event.time
        ? event.time.toISOString().replace('T', ' ').substring(0, 19)
        : 'Unknown time'
      return `${time} - [${event.type}] ${event.event}`
    })
    .join('\n')

  const logsText = selectImportantLogs(parsedLogs)

  const teamInfo = `
On-call Engineer: ${onCallEngineer || 'Not specified'}
Incident Commander: ${incidentCommander || 'Not specified'}
Participants: ${participants?.join(', ') || 'Not specified'}
  `.trim()

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
  const result = await model.generateContent(prompt)
  const text = result.response.text()

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