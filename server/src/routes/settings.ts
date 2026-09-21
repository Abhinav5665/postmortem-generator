import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'

const router = Router()

const SettingsSchema = z.object({
  slackWebhook: z.string().url('Must be a valid URL').optional().nullable(),
})

// GET /api/settings — fetch current settings
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    })

    res.json({ success: true, data: settings })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PATCH /api/settings — update settings
router.patch('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = SettingsSchema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
      return
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        slackWebhook: result.data.slackWebhook,
      },
      create: {
        id: 'default',
        slackWebhook: result.data.slackWebhook,
      },
    })

    res.json({ success: true, data: settings })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router