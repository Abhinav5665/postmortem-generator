import { Router, Request, Response } from 'express'
import { ZodError } from 'zod'
import { prisma } from '../lib/prisma'
import * as logParserService from '../services/logParser'
import * as timelineService from '../services/timelineBuilder'
import severityScorer from '../services/severityScorer'
import * as aiService from '../services/aiService'
import { upload } from '../middleware/upload'
import { validateBody, IncidentSchema } from '../middleware/validate'
import * as slackService from '../services/slackService'
import * as recurringDetector from '../services/recurringDetector'


console.log('severityScorer module:', Object.keys(severityScorer))

const router = Router()

// GET /api/incidents — fetch all incidents
router.get('/', async (req: Request, res: Response): Promise<void> => {
   console.log('GET /api/incidents hit')
  try {
    const incidents = await prisma.incident.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        serviceName: true,
        startTime: true,
        endTime: true,
        severity: true,
        status: true,
        createdAt: true,
        postmortem: {
          select: {
            id: true,
            generatedAt: true,
              recurringAlert: true,
          },
        },
      },
    })

    res.json({ success: true, data: incidents })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incidents' })
  }
})

// GET /api/incidents/:id — fetch one incident with postmortem
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: String(req.params.id) },
      include: { postmortem: true },
    })

    if (!incident) {
      res.status(404).json({ error: 'Incident not found' })
      return
    }

    res.json({ success: true, data: incident })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incident' })
  }
})

// POST /api/incidents — create incident + generate postmortem
router.post(
  '/',
  upload.single('logFile'),
  validateBody(IncidentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        serviceName,
        startTime,
        endTime,
        engineerNotes,
        rawLogs,
        teamMembers,
         templateType,
      } = req.body

      // If file uploaded, use file contents — otherwise use pasted logs
      let logsText: string = rawLogs || ''
      if (req.file) {
        logsText = req.file.buffer.toString('utf-8')
      }

      if (!logsText) {
        res.status(400).json({ error: 'Logs are required — paste logs or upload a file' })
        return
      }

      const start = new Date(startTime)
      const end = new Date(endTime)

      if (end <= start) {
        res.status(400).json({ error: 'End time must be after start time' })
        return
      }

      // Parse participants from comma separated string
    const teamMembersList = teamMembers
  ? JSON.parse(teamMembers)
  : []

      // Run all services
      const durationMinutes = severityScorer.getDurationMinutes(start, end)
      const parsedLogs = logParserService.parseLogs(logsText)
      const timeline = timelineService.buildTimeline(parsedLogs.logs, start, end)
      const severityResult = severityScorer.scoreSeverity(
  durationMinutes,
  parsedLogs.fatalCount,
  parsedLogs.errorCount,
  parsedLogs.warnCount,
  parsedLogs.totalLines
)

      // Generate postmortem with Gemini
      const postmortemResult = await aiService.generatePostmortem(
        serviceName,
        start,
        end,
        durationMinutes,
        parsedLogs,
        timeline,
        engineerNotes,
        severityResult,
        teamMembersList,
        templateType || 'General',
      )

      // Save incident and postmortem to DB in one transaction
      const incident = await prisma.incident.create({
        data: {
          serviceName,
          startTime: start,
          endTime: end,
          rawLogs: logsText,
          engineerNotes,
          severity: severityResult.level,
          status: 'OPEN',
          templateType: templateType || 'General',
          teamMembers: JSON.parse(JSON.stringify(teamMembersList)),
          postmortem: {
            create: {
              summary: postmortemResult.summary,
              timeline: JSON.parse(JSON.stringify(timeline)),
              rootCause: postmortemResult.rootCause,
              impact: postmortemResult.impact,
              impactMetrics: postmortemResult.impactMetrics,
              resolution: postmortemResult.resolution,
              wentWell: postmortemResult.wentWell,
              actionItems: postmortemResult.actionItems,
              severity: severityResult.level,
            },
          },
        },
        include: { postmortem: true },
      })

      // Check for recurring incidents
// Check for recurring incidents
const recurringResult = await recurringDetector.checkRecurringIncident(
  serviceName,
  incident.id,
  postmortemResult.rootCause,
  postmortemResult.summary
)

console.log('Recurring check result:', JSON.stringify(recurringResult))

if (recurringResult.isRecurring) {
  await prisma.postmortem.update({
    where: { incidentId: incident.id },
    data: {
      recurringAlert: JSON.parse(JSON.stringify(recurringResult)),
    },
  })
}

// Fetch updated incident with recurringAlert included
const updatedIncident = await prisma.incident.findUnique({
  where: { id: incident.id },
  include: { postmortem: true },
})

res.status(201).json({ success: true, data: updatedIncident })
    

    } catch (error) {
      if (error instanceof SyntaxError) {
        res.status(502).json({ error: 'AI returned an invalid response, please try again' })
      } else if (error instanceof ZodError) {
        res.status(502).json({ error: 'AI response structure was unexpected, please try again' })
      } else {
        console.error('Incident creation error:', error)
        res.status(500).json({ error: 'Failed to create incident and generate postmortem' })
      }
    }
  }
)


// POST /api/incidents/:id/notify-slack
router.post('/:id/notify-slack', async (req: Request, res: Response): Promise<void> => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: String(req.params.id) },
      include: { postmortem: true },
    })

    if (!incident) {
      res.status(404).json({ error: 'Incident not found' })
      return
    }

    if (!incident.postmortem) {
      res.status(404).json({ error: 'No postmortem found for this incident' })
      return
    }

    const postmortem = incident.postmortem
    const actionItems = postmortem.actionItems as {
      task: string
      owner: string
      completed: boolean
    }[]

    const durationMinutes = Math.round(
      (new Date(incident.endTime).getTime() - new Date(incident.startTime).getTime()) / 1000 / 60
    )
    const duration = durationMinutes < 60
      ? `${durationMinutes}m`
      : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`

    await slackService.sendPostmortemToSlack({
      serviceName: incident.serviceName,
      severity: incident.severity as 'P0' | 'P1' | 'P2',
      status: incident.status as 'OPEN' | 'RESOLVED',
      duration,
      summary: postmortem.summary,
      impactMetrics: postmortem.impactMetrics as {
        failureRate: string
        affectedUsers: string
        downtime: string
      },
      actionItems,
      incidentId: incident.id,
    })

    res.json({ success: true, message: 'Postmortem sent to Slack successfully' })
  } catch (error) {
    console.error('Slack notification error:', error)
    if (error instanceof Error && error.message === 'Slack webhook URL is not configured') {
      res.status(503).json({ error: 'Slack is not configured. Add SLACK_WEBHOOK_URL to your .env file.' })
    } else {
      res.status(500).json({ error: 'Failed to send Slack notification' })
    }
  }
})


// PATCH /api/incidents/:id/status — update incident status
router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body

    if (!['OPEN', 'RESOLVED'].includes(status)) {
      res.status(400).json({ error: 'Status must be OPEN or RESOLVED' })
      return
    }

    const incident = await prisma.incident.update({
      where: { id: String(req.params.id) },
      data: { status },
    })

    res.json({ success: true, data: incident })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update incident status' })
  }
})

export default router