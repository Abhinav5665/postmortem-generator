import { ParsedLog } from './logParser'

export interface TimelineEvent {
  time: string | null
  event: string
  type: 'ALERT_START' | 'ALERT_END' | 'ERROR' | 'FATAL' | 'WARN' | 'INFO'
}

// Cap INFO noise (health checks, heartbeats) so it can't bury the real events
const MAX_INFO_EVENTS = 20

export function buildTimeline(
  parsedLogs: ParsedLog[],
  alertStart: Date,
  alertEnd: Date
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    time: alertStart.toISOString(),
    event: 'Alert triggered — incident begins',
    type: 'ALERT_START',
  })

  let infoCount = 0

  for (const log of parsedLogs) {
    if (log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'WARN') {
      events.push({
        time: log.timestamp ? log.timestamp.toISOString() : null,
        event: log.message || log.raw,
        type: log.level,
      })
    } else if (log.level === 'INFO' && infoCount < MAX_INFO_EVENTS) {
      // INFO lines often hold the fix steps (restarts, config changes, recovery)
      events.push({
        time: log.timestamp ? log.timestamp.toISOString() : null,
        event: log.message || log.raw,
        type: 'INFO',
      })
      infoCount++
    }
  }

  events.push({
    time: alertEnd.toISOString(),
    event: 'Incident resolved',
    type: 'ALERT_END',
  })

  // Sort by time. Events without a timestamp go last.
  // Array.sort is stable, so ties keep insertion order (ALERT_START first, ALERT_END last).
  return events.sort((a, b) => {
    if (!a.time && !b.time) return 0
    if (!a.time) return 1
    if (!b.time) return -1
    return new Date(a.time).getTime() - new Date(b.time).getTime()
  })
}