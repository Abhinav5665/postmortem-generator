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

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { id: string }

    // Load the current user so removed users and role changes take effect immediately
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
    res.status(401).json({ error: 'Invalid or expired token' })
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