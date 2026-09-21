import { Router, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendInvitationEmail } from '../services/emailService'

const router = Router()

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})

const AcceptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// POST /api/invitations — admin sends invite
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = InviteSchema.safeParse(req.body)
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

      const { email, role } = result.data

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        res.status(400).json({ error: 'User with this email already exists' })
        return
      }

      // Check if pending invite exists
      const existingInvite = await prisma.invitation.findFirst({
        where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
      })
      if (existingInvite) {
        res.status(400).json({ error: 'Invitation already sent to this email' })
        return
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = await bcrypt.hash(token, 10)

      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 48)

      await prisma.invitation.create({
        data: {
          email,
          role,
          tokenHash,
          expiresAt,
          invitedById: req.user!.id,
        },
      })

      await sendInvitationEmail(email, token, req.user!.name)

      res.status(201).json({ success: true, message: 'Invitation sent successfully' })
    } catch (error) {
      console.error('Invitation error:', error)
      res.status(500).json({ error: 'Failed to send invitation' })
    }
  }
)

// GET /api/invitations — list all invitations (admin only)
router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const invitations = await prisma.invitation.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
          invitedBy: {
            select: { name: true },
          },
        },
      })
      res.json({ success: true, data: invitations })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invitations' })
    }
  }
)

// GET /api/invitations/validate/:token — validate invite token
router.get('/validate/:token', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token)

    const invitations = await prisma.invitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    let validInvitation = null
    for (const inv of invitations) {
      const match = await bcrypt.compare(token, inv.tokenHash)
      if (match) {
        validInvitation = inv
        break
      }
    }

    if (!validInvitation) {
      res.status(400).json({ error: 'Invalid or expired invitation link' })
      return
    }

    res.json({
      success: true,
      data: {
        email: validInvitation.email,
        role: validInvitation.role,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate invitation' })
  }
})

// POST /api/invitations/accept/:token — accept invitation
router.post('/accept/:token', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token)

    const result = AcceptSchema.safeParse(req.body)
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

    const { name, password } = result.data

    const invitations = await prisma.invitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    let validInvitation = null
    for (const inv of invitations) {
      const match = await bcrypt.compare(token, inv.tokenHash)
      if (match) {
        validInvitation = inv
        break
      }
    }

    if (!validInvitation) {
      res.status(400).json({ error: 'Invalid or expired invitation link' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: validInvitation.email,
        passwordHash,
        name,
        role: validInvitation.role,
      },
    })

    await prisma.invitation.update({
      where: { id: validInvitation.id },
      data: { acceptedAt: new Date() },
    })

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || '',
      { expiresIn: '7d' }
    )

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Accept invitation error:', error)
    res.status(500).json({ error: 'Failed to accept invitation' })
  }
})

// DELETE /api/invitations/:id — cancel invitation (admin only)
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await prisma.invitation.delete({
        where: { id: String(req.params.id) },
      })
      res.json({ success: true, message: 'Invitation cancelled' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to cancel invitation' })
    }
  }
)

export default router