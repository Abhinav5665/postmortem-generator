import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { z } from 'zod'

const router = Router()

const UpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
})

// GET /api/team — list all users (admin only)
router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      })
      res.json({ success: true, data: users })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch team members' })
    }
  }
)

// PATCH /api/team/:id/role — change user role (admin only)
router.patch(
  '/:id/role',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Prevent admin from changing their own role
      if (req.params.id === req.user!.id) {
        res.status(400).json({ error: 'You cannot change your own role' })
        return
      }

      const result = UpdateRoleSchema.safeParse(req.body)
      if (!result.success) {
        res.status(400).json({ error: 'Invalid role' })
        return
      }

      const user = await prisma.user.update({
        where: { id: String(req.params.id) },
        data: { role: result.data.role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })

      res.json({ success: true, data: user })
    } catch (error) {
      res.status(500).json({ error: 'Failed to update role' })
    }
  }
)

// DELETE /api/team/:id — remove user (admin only)
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.params.id === req.user!.id) {
        res.status(400).json({ error: 'You cannot remove yourself' })
        return
      }

      await prisma.user.delete({
        where: { id: String(req.params.id) },
      })

      res.json({ success: true, message: 'Team member removed' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove team member' })
    }
  }
)

export default router