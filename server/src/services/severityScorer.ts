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
  errorCount: number
): SeverityResult {

  // P0 — Critical, major outage
  if (fatalCount > 0 || durationMinutes > 60) {
    return {
      level: 'P0',
      reasoning: fatalCount > 0
        ? `Fatal errors detected (${fatalCount} fatal log entries found)`
        : `Incident lasted over 60 minutes (${durationMinutes} minutes)`
    }
  }

  // P1 — Significant, degraded service
  if (durationMinutes > 15 || errorCount > 50) {
    return {
      level: 'P1',
      reasoning: errorCount > 50
        ? `High error volume detected (${errorCount} errors found)`
        : `Incident lasted over 15 minutes (${durationMinutes} minutes)`
    }
  }

  // P2 — Minor, limited impact
  return {
    level: 'P2',
    reasoning: `Short incident (${durationMinutes} minutes) with low error volume (${errorCount} errors)`
  }
}

export function getDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)
}