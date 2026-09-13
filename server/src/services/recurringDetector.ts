import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { GoogleGenAI } from '@google/genai'

export interface RecurringIncidentResult {
  isRecurring: boolean
  serviceIncidentCount: number
  pattern: string
  recommendation: string
}

const RecurringIncidentSchema = z.object({
  isRecurring: z.boolean(),
  pattern: z.string(),
  recommendation: z.string(),
})

export async function checkRecurringIncident(
  serviceName: string,
  currentIncidentId: string,
  currentRootCause: string,
  currentSummary: string
): Promise<RecurringIncidentResult> {

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentIncidents = await prisma.incident.findMany({
    where: {
      serviceName: {
        equals: serviceName,
        mode: 'insensitive',
      },
      createdAt: {
        gte: thirtyDaysAgo,
      },
      id: {
        not: currentIncidentId,
      },
    },
    include: {
      postmortem: {
        select: {
          rootCause: true,
          summary: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Not enough history to detect a pattern
  if (recentIncidents.length < 2) {
    return {
      isRecurring: false,
      serviceIncidentCount: recentIncidents.length + 1,
      pattern: 'No clear recurring pattern',
      recommendation: 'Not specified',
    }
  }

  const previousIncidentsSummary = recentIncidents
    .map((inc, i) => `
Incident ${i + 1} (${inc.createdAt.toISOString().substring(0, 10)}):
Root Cause: ${inc.postmortem?.rootCause || 'Not specified'}
Summary: ${inc.postmortem?.summary || 'Not specified'}
    `.trim())
    .join('\n\n')

  // Note: previous root causes are AI-inferred, not necessarily observed facts.
  // If a previous postmortem incorrectly identified a root cause, that inference
  // flows into this detector. Future improvement: distinguish observed vs inferred.

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

  const prompt = `
You are analyzing whether a series of incidents for the same service share a meaningful recurring pattern.

Service: ${serviceName}
Total same-service incidents in last 30 days: ${recentIncidents.length + 1}

CURRENT INCIDENT:
Root Cause: ${currentRootCause}
Summary: ${currentSummary}

PREVIOUS INCIDENTS:
${previousIncidentsSummary}

CRITICAL RULES:
- A recurring pattern means the same underlying root cause is appearing repeatedly — NOT just that the same service failed multiple times.
- Do NOT assume incidents are related simply because they affected the same service.
- Compare root causes carefully. Distinguish repeated symptoms from a repeated underlying cause.
- A database timeout and an expired TLS certificate are NOT the same pattern even if both hit the same service.
- The CURRENT incident must be considered part of the pattern for isRecurring to be true.
- It is enough for the current incident to share the same underlying root cause with at least two previous incidents — not every previous incident needs to belong to the pattern.
- Only return isRecurring as true when there is clear, specific evidence of the same underlying cause appearing in the current incident AND at least two previous incidents.
- If the incidents do not share a clear common root cause, return isRecurring as false.
- Never invent facts not present in the incident data.
- Recommendations must directly address the identified recurring pattern — not generic advice.
- If no clear recurring pattern exists, pattern must be "No clear recurring pattern" and recommendation must be "Not specified".

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "isRecurring": true or false,
  "pattern": "One sentence describing the specific recurring pattern, or No clear recurring pattern",
  "recommendation": "One specific actionable recommendation that directly addresses the recurring root cause, or Not specified"
}
`

  const result = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    contents: prompt,
  })

  const text = result.text || ''
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()

  try {
    const parsed = RecurringIncidentSchema.parse(JSON.parse(cleaned))
    return {
      isRecurring: parsed.isRecurring,
      serviceIncidentCount: recentIncidents.length + 1,
      pattern: parsed.pattern,
      recommendation: parsed.recommendation,
    }
  } catch (error) {
    // Log real error for debugging, throw clean message to the route handler
    console.error('Recurring incident AI parsing error:', error)
    throw new Error('AI returned an invalid recurring-incident response')
  }
}