import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma'
import { z } from 'zod'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

class RegistrationClosed extends Error {}

// Compared against when the email doesn't exist, so response time is the same
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
})

const isProd = process.env.NODE_ENV === 'production'

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
}



function signAndSetCookie(
  res: Response,
  user: { id: string; email: string; name: string; role: string }
): boolean {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET is not set')
    return false
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    secret,
    { expiresIn: '7d' }
  )
  res.cookie('token', token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
  return true
}

// GET /api/auth/setup — check if first user needs to be created
router.get('/setup', async (req: Request, res: Response): Promise<void> => {
  try {
    const userCount = await prisma.user.count()
    res.json({ success: true, needsSetup: userCount === 0 })
  } catch (error) {
    console.error('Setup check error:', error)
    res.status(500).json({ error: 'Failed to check setup status' })
  }
})

// POST /api/auth/register — first user only becomes admin
router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = RegisterSchema.safeParse(req.body)
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

    const { email, password, name } = result.data
    const passwordHash = await bcrypt.hash(password, 12)

    // Count + create in one serializable transaction so two simultaneous
    // requests can't both become admin
    const user = await prisma.$transaction(
      async tx => {
        if ((await tx.user.count()) > 0) throw new RegistrationClosed()
        return tx.user.create({
          data: { email, passwordHash, name, role: 'ADMIN' },
        })
      },
      { isolationLevel: 'Serializable' }
    )

    if (!signAndSetCookie(res, user)) {
      res.status(500).json({ error: 'Server is not configured correctly' })
      return
    }

    res.status(201).json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (error instanceof RegistrationClosed || code === 'P2034' || code === 'P2002') {
      res.status(403).json({
        error: 'Registration is closed. Ask your admin to invite you.',
      })
      return
    }
    console.error('Register error:', error)
    res.status(500).json({ error: 'Failed to register' })
  }
})

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = LoginSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid email or password' })
      return
    }

    const { email, password } = result.data

    const user = await prisma.user.findUnique({ where: { email } })

    // Always run bcrypt so unknown emails take the same time as wrong passwords
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    if (!signAndSetCookie(res, user)) {
      res.status(500).json({ error: 'Server is not configured correctly' })
      return
    }

    res.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Failed to login' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ success: true, data: user })
  } catch (error) {
    console.error('Fetch user error:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('token', cookieOptions)
  res.json({ success: true, message: 'Logged out successfully' })
})

export default router