import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody, UpdatePostmortemSchema } from '../middleware/validate'

const router = Router()

// GET /api/postmortems/:id — fetch one postmortem
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const postmortem = await prisma.postmortem.findUnique({
      where: { id: String(req.params.id) },
      include: {
        incident: {
          select: {
            id: true,
            serviceName: true,
            startTime: true,
            endTime: true,
            severity: true,
            status: true,
            onCallEngineer: true,
            incidentCommander: true,
            participants: true,
          },
        },
      },
    })

    if (!postmortem) {
      res.status(404).json({ error: 'Postmortem not found' })
      return
    }

    res.json({ success: true, data: postmortem })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch postmortem' })
  }
})

// PATCH /api/postmortems/:id — edit postmortem fields
router.patch(
  '/:id',
  validateBody(UpdatePostmortemSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const existing = await prisma.postmortem.findUnique({
        where: { id: String(req.params.id) },
      })

      if (!existing) {
        res.status(404).json({ error: 'Postmortem not found' })
        return
      }

      const updated = await prisma.postmortem.update({
        where: { id: String(req.params.id) },
        data: {
          ...req.body,
          // If actionItems provided, cast to plain JSON
          ...(req.body.actionItems && {
            actionItems: JSON.parse(JSON.stringify(req.body.actionItems)),
          }),
          isEdited: true,
          editedAt: new Date(),
        },
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(500).json({ error: 'Failed to update postmortem' })
    }
  }
)

// PATCH /api/postmortems/:id/action-items/:index — toggle action item completed
router.patch(
  '/:id/action-items/:index',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const postmortem = await prisma.postmortem.findUnique({
        where: { id: String(req.params.id) },
      })

      if (!postmortem) {
        res.status(404).json({ error: 'Postmortem not found' })
        return
      }

     const index = parseInt(String(req.params.index))
      const actionItems = postmortem.actionItems as {
        task: string
        owner: string
        dueDate: string
        completed: boolean
      }[]

      if (index < 0 || index >= actionItems.length) {
        res.status(400).json({ error: 'Invalid action item index' })
        return
      }

      // Toggle completed
      actionItems[index].completed = !actionItems[index].completed

      const updated = await prisma.postmortem.update({
        where: { id: String(req.params.id) },
        data: {
          actionItems: JSON.parse(JSON.stringify(actionItems)),
          isEdited: true,
          editedAt: new Date(),
        },
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle action item' })
    }
  }
)

export default router