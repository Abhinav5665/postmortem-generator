export type SeverityLevel = 'P0' | 'P1' | 'P2'

export interface SeverityResult {
  level: SeverityLevel
  reasoning: string
  score: number
}

export interface SeverityContext {
  durationMinutes: number
  fatalCount: number
  errorCount: number

  // Impact signals (all optional, entered by the engineer)
  affectedUsers?: number
  serviceUnavailable?: boolean
  confirmedCompromise?: boolean
  dataBreach?: boolean
}

export function scoreSeverity(context: SeverityContext): SeverityResult {
  const {
    durationMinutes,
    fatalCount,
    errorCount,
    affectedUsers = 0,
    serviceUnavailable = false,
    confirmedCompromise = false,
    dataBreach = false,
  } = context

  let score = 0
  const reasons: string[] = []

  // 1. Security impact (each one alone reaches P0)
  if (confirmedCompromise) {
    score += 8
    reasons.push('Confirmed security compromise')
  }
  if (dataBreach) {
    score += 8
    reasons.push('Confirmed data breach')
  }

  // 2. Availability
  if (serviceUnavailable) {
    score += 4
    reasons.push('Service fully unavailable')
  }

  // 3. Fatal errors
  if (fatalCount > 0) {
    score += 5
    reasons.push(`${fatalCount} fatal error(s) detected`)
  }

  // 4. Affected users
  if (affectedUsers > 10000) {
    score += 5
    reasons.push(`Very large user impact: ${affectedUsers} users`)
  } else if (affectedUsers > 1000) {
    score += 4
    reasons.push(`Large user impact: ${affectedUsers} users`)
  } else if (affectedUsers > 100) {
    score += 3
    reasons.push(`Significant user impact: ${affectedUsers} users`)
  } else if (affectedUsers > 50) {
    score += 2
    reasons.push(`Moderate user impact: ${affectedUsers} users`)
  } else if (affectedUsers > 0) {
    score += 1
    reasons.push(`Limited user impact: ${affectedUsers} users`)
  }

  // 5. Duration
  if (durationMinutes > 120) {
    score += 4
    reasons.push(`Extended incident: ${durationMinutes} minutes`)
  } else if (durationMinutes > 60) {
    score += 2
    reasons.push(`Long incident: ${durationMinutes} minutes`)
  } else if (durationMinutes > 30) {
    score += 1
    reasons.push(`Moderate duration: ${durationMinutes} minutes`)
  }

  // 6. Error volume
  if (errorCount > 100) {
    score += 3
    reasons.push(`Very high error volume: ${errorCount} errors`)
  } else if (errorCount > 50) {
    score += 2
    reasons.push(`High error volume: ${errorCount} errors`)
  } else if (errorCount > 20) {
    score += 1
    reasons.push(`Elevated error volume: ${errorCount} errors`)
  }

  // 7. Error density (errors per minute)
  const errorDensity = durationMinutes > 0 ? errorCount / durationMinutes : errorCount
  if (errorDensity > 10) {
    score += 2
    reasons.push(`High error density: ${errorDensity.toFixed(1)} errors/min`)
  } else if (errorDensity > 3) {
    score += 1
    reasons.push(`Elevated error density: ${errorDensity.toFixed(1)} errors/min`)
  }

  let level: SeverityLevel
  if (score >= 8) level = 'P0'
  else if (score >= 3) level = 'P1'
  else level = 'P2'

  return {
    level,
    score,
    reasoning: reasons.join(', ') || 'Low impact incident',
  }
}

export function getDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)
}

export default {
  scoreSeverity,
  getDurationMinutes,
}