import { Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'

export const IncidentSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required'),
  startTime: z.iso.datetime({ error: 'Start time must be a valid ISO date' }),
  endTime: z.iso.datetime({ error: 'End time must be a valid ISO date' }),
  engineerNotes: z.string().min(1, 'Engineer notes are required'),
  rawLogs: z.string().optional(),
  teamMembers: z.string().optional(),
  templateType: z.string().optional(),

  // Severity override: '' means "Auto" (use detected severity)
  severityOverride: z.union([z.enum(['P0', 'P1', 'P2']), z.literal('')]).optional(),

  // Impact signals. Multipart forms send strings, so accept both strings and real types
  affectedUsers: z
  .union([
    z.string().regex(/^\d{0,8}$/, 'Affected users must be a whole number'),
    z.number().int().nonnegative().max(10_000_000),
  ])
  .optional(),
  serviceUnavailable: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  confirmedCompromise: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  dataBreach: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
})

export const UpdatePostmortemSchema = z.object({
  summary: z.string().min(1).optional(),
  rootCause: z.string().min(1).optional(),
  impact: z.string().min(1).optional(),
  resolution: z.string().min(1).optional(),
  wentWell: z.string().min(1).optional(),
  actionItems: z.array(z.object({
    task: z.string(),
    owner: z.string(),
    dueDate: z.string(),
    completed: z.boolean(),
  })).optional(),
})

export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
      return
    }

    req.body = result.data
    next()
  }
}