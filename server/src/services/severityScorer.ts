export default {
  scoreSeverity,
  getDurationMinutes,
}


export type SeverityLevel = 'P0' | 'P1' | 'P2'

export interface SeverityResult {
  level: SeverityLevel
  reasoning: string
}

export function scoreSeverity(
  durationMinutes: number,
  fatalCount: number,
  errorCount: number,
  warnCount: number,
  totalLines: number
): SeverityResult {

  // Calculate error density — errors per minute
  const errorDensity = durationMinutes > 0 ? errorCount / durationMinutes : errorCount

  // P0 — Critical, major outage
  if (fatalCount > 0) {
    return {
      level: 'P0',
      reasoning: `Fatal errors detected (${fatalCount} fatal log entries)`
    }
  }

  if (durationMinutes > 60) {
    return {
      level: 'P0',
      reasoning: `Extended outage — incident lasted ${durationMinutes} minutes`
    }
  }

  if (errorCount > 100) {
    return {
      level: 'P0',
      reasoning: `Extremely high error volume (${errorCount} errors)`
    }
  }

  if (errorDensity > 10) {
    return {
      level: 'P0',
      reasoning: `Very high error density — ${errorDensity.toFixed(1)} errors per minute`
    }
  }

  // P1 — Significant, degraded service
  if (durationMinutes > 30) {
    return {
      level: 'P1',
      reasoning: `Incident lasted ${durationMinutes} minutes`
    }
  }

  if (errorCount > 50) {
    return {
      level: 'P1',
      reasoning: `High error volume (${errorCount} errors)`
    }
  }

  if (errorDensity > 3) {
    return {
      level: 'P1',
      reasoning: `Elevated error density — ${errorDensity.toFixed(1)} errors per minute`
    }
  }

  if (warnCount > 20 && errorCount > 10) {
    return {
      level: 'P1',
      reasoning: `Combined high warning and error volume (${warnCount} warnings, ${errorCount} errors)`
    }
  }

  // P2 — Minor, limited impact
  return {
    level: 'P2',
    reasoning: `Low impact — ${durationMinutes} minutes, ${errorCount} errors, ${warnCount} warnings`
  }
}

export function getDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)
}