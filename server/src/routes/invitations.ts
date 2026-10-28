import { Router, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/authMiddleware'

import { sendInvitationEmail, buildInviteUrl } from '../services/emailService'
const router = Router()

// Tokens are 256-bit random, so a fast deterministic hash is enough
// and lets us look the invitation up directly (tokenHash is @unique)
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

// Limit brute-force attempts on the public endpoints
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
})

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})

const AcceptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

class InviteError extends Error {}

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

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        res.status(400).json({ error: 'User with this email already exists' })
        return
      }

      const existingInvite = await prisma.invitation.findFirst({
        where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
      })
      if (existingInvite) {
        res.status(400).json({ error: 'Invitation already sent to this email' })
        return
      }

      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = hashToken(token)

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

      const emailSent = await sendInvitationEmail(email, token, req.user!.name)

res.status(201).json({
  success: true,
  emailSent,
  inviteUrl: buildInviteUrl(token), // only the admin who created the invite sees this
  message: emailSent
    ? 'Invitation sent successfully'
    : 'Invitation created. Email could not be sent, so share the link manually.',
})
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
      console.error('List invitations error:', error)
      res.status(500).json({ error: 'Failed to fetch invitations' })
    }
  }
)

// GET /api/invitations/validate/:token — validate invite token
router.get(
  '/validate/:token',
  publicLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const token = String(req.params.token)

      const validInvitation = await prisma.invitation.findFirst({
        where: {
          tokenHash: hashToken(token),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      })

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
      console.error('Validate invitation error:', error)
      res.status(500).json({ error: 'Failed to validate invitation' })
    }
  }
)

// POST /api/invitations/accept/:token — accept invitation
router.post(
  '/accept/:token',
  publicLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const jwtSecret = process.env.JWT_SECRET
      if (!jwtSecret) {
        console.error('JWT_SECRET is not set')
        res.status(500).json({ error: 'Server is not configured correctly' })
        return
      }

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

      const validInvitation = await prisma.invitation.findFirst({
        where: {
          tokenHash: hashToken(token),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      })

      if (!validInvitation) {
        res.status(400).json({ error: 'Invalid or expired invitation link' })
        return
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: validInvitation.email },
      })
      if (existingUser) {
        res.status(400).json({ error: 'An account with this email already exists' })
        return
      }

      const passwordHash = await bcrypt.hash(password, 12)

      // Claim the invitation and create the user atomically.
      // updateMany with acceptedAt: null guarantees only one request wins.
      const user = await prisma.$transaction(async tx => {
        const claimed = await tx.invitation.updateMany({
          where: { id: validInvitation.id, acceptedAt: null },
          data: { acceptedAt: new Date() },
        })
        if (claimed.count === 0) {
          throw new InviteError('Invitation already used')
        }

        return tx.user.create({
          data: {
            email: validInvitation.email,
            passwordHash,
            name,
            role: validInvitation.role,
          },
        })
      })

      const jwtToken = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        jwtSecret,
        { expiresIn: '7d' }
      )

     const isProd = process.env.NODE_ENV === 'production'

res.cookie('token', jwtToken, {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
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
      if (error instanceof InviteError) {
        res.status(400).json({ error: 'Invalid or expired invitation link' })
        return
      }
      if ((error as { code?: string })?.code === 'P2002') {
        res.status(400).json({ error: 'An account with this email already exists' })
        return
      }
      console.error('Accept invitation error:', error)
      res.status(500).json({ error: 'Failed to accept invitation' })
    }
  }
)

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
      if ((error as { code?: string })?.code === 'P2025') {
        res.status(404).json({ error: 'Invitation not found' })
        return
      }
      console.error('Cancel invitation error:', error)
      res.status(500).json({ error: 'Failed to cancel invitation' })
    }
  }
)

export default router