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
            teamMembers: true,
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

      const existingHistory = (existing.editHistory as {
        field: string
        oldValue: string
        newValue: string
        editedAt: string
      }[]) || []

      // Only record fields whose values actually changed
      const newHistoryEntries = Object.keys(req.body)
        .filter(key => key !== 'actionItems')
        .filter(key => {
          const oldValue = existing[key as keyof typeof existing]
          const newValue = req.body[key]
          return String(oldValue ?? '') !== String(newValue ?? '')
        })
        .map(key => ({
          field: key,
          oldValue: String(existing[key as keyof typeof existing] ?? ''),
          newValue: String(req.body[key] ?? ''),
          editedAt: new Date().toISOString(),
        }))

      // Only record action items if they actually changed
      if (req.body.actionItems !== undefined) {
        const oldActionItems = JSON.stringify(existing.actionItems)
        const newActionItems = JSON.stringify(req.body.actionItems)
        if (oldActionItems !== newActionItems) {
          newHistoryEntries.push({
            field: 'actionItems',
            oldValue: oldActionItems,
            newValue: newActionItems,
            editedAt: new Date().toISOString(),
          })
        }
      }

      const hasChanges = newHistoryEntries.length > 0

      const updated = await prisma.postmortem.update({
        where: { id: String(req.params.id) },
        data: {
          ...req.body,
          ...(req.body.actionItems !== undefined && {
            actionItems: JSON.parse(JSON.stringify(req.body.actionItems)),
          }),
          isEdited: hasChanges ? true : existing.isEdited,
          editedAt: hasChanges ? new Date() : existing.editedAt,
          editHistory: JSON.parse(JSON.stringify([
            ...existingHistory,
            ...newHistoryEntries,
          ])),
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

      const oldActionItems = JSON.stringify(actionItems)

      // Toggle completed
      actionItems[index].completed = !actionItems[index].completed

      // Add to edit history
      const existingHistory = (postmortem.editHistory as {
        field: string
        oldValue: string
        newValue: string
        editedAt: string
      }[]) || []

      const newHistory = [
        ...existingHistory,
        {
          field: 'actionItems',
          oldValue: oldActionItems,
          newValue: JSON.stringify(actionItems),
          editedAt: new Date().toISOString(),
        },
      ]

      const updated = await prisma.postmortem.update({
        where: { id: String(req.params.id) },
        data: {
          actionItems: JSON.parse(JSON.stringify(actionItems)),
          isEdited: true,
          editedAt: new Date(),
          editHistory: JSON.parse(JSON.stringify(newHistory)),
        },
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle action item' })
    }
  }
)

export default router