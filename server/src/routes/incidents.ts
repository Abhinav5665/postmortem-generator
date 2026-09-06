import { Router, Request, Response } from 'express'
import { ZodError } from 'zod'
import { prisma } from '../lib/prisma'
import * as logParserService from '../services/logParser'
import * as timelineService from '../services/timelineBuilder'
import severityScorer from '../services/severityScorer'
import * as aiService from '../services/aiService'
import { upload } from '../middleware/upload'
import { validateBody, IncidentSchema } from '../middleware/validate'
console.log('severityScorer module:', Object.keys(severityScorer))

const router = Router()

// GET /api/incidents — fetch all incidents
router.get('/', async (req: Request, res: Response): Promise<void> => {
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
        onCallEngineer,
        incidentCommander,
        participants,
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
      const participantsList = participants
        ? participants.split(',').map((p: string) => p.trim()).filter(Boolean)
        : []

      // Run all services
      const durationMinutes = severityScorer.getDurationMinutes(start, end)
      const parsedLogs = logParserService.parseLogs(logsText)
      const timeline = timelineService.buildTimeline(parsedLogs.logs, start, end)
      const severityResult = severityScorer.scoreSeverity(durationMinutes, parsedLogs.fatalCount, parsedLogs.errorCount)

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
        onCallEngineer,
        incidentCommander,
        participantsList
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
          onCallEngineer: onCallEngineer || null,
          incidentCommander: incidentCommander || null,
          participants: participantsList,
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

      res.status(201).json({ success: true, data: incident })

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