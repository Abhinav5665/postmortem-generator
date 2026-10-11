import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'
import { adminMiddleware } from '../middleware/authMiddleware'

const router = Router()
const SettingsSchema = z.object({
  slackWebhook: z
    .string()
    .trim()
    .transform(v => (v === '' ? null : v))
    .nullable()
    .optional()
    .refine(v => {
      if (v == null) return true
      try {
        const u = new URL(v)
        return u.protocol === 'https:' && u.hostname === 'hooks.slack.com'
      } catch {
        return false
      }
    }, 'Must be a Slack webhook URL (https://hooks.slack.com/...)'),
})

function toPublic(s: { id: string; slackWebhook: string | null; updatedAt: Date } | null) {
  if (!s) return null
  return {
    id: s.id,
    slackConnected: !!s.slackWebhook,
    slackWebhookHint: s.slackWebhook ? `…${s.slackWebhook.slice(-4)}` : null,
    updatedAt: s.updatedAt,
  }
}

// GET /api/settings — fetch current settings
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    })

    res.json({ success: true, data: toPublic(settings) })
  } catch (error) {
      console.error('Fetch settings error:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})





// PATCH /api/settings — update settings
router.patch('/',adminMiddleware, async (req: Request, res: Response): Promise<void> => {
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

    res.json({ success: true, data: toPublic(settings) })
  } catch (error) {
      console.error('Update settings error:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router