import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.token

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET is not set')
    res.status(500).json({ error: 'Server is not configured correctly' })
    return
  }

  // 1. Token problems are real auth failures: 401
  let decoded: { id: string }
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { id: string }
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  // 2. Database problems are not the user's fault: 503, never 401
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    })

    if (!user) {
      res.status(401).json({ error: 'User no longer exists' })
      return
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Auth lookup failed (database unreachable?):', (error as Error).message)
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' })
  }
}

export function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}