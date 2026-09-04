import { ParsedLog } from './logParser'

export interface TimelineEvent {
  time: Date | null
  event: string
  type: 'ALERT_START' | 'ALERT_END' | 'ERROR' | 'FATAL' | 'WARN' | 'INFO'
}

export function buildTimeline(
  parsedLogs: ParsedLog[],
  alertStart: Date,
  alertEnd: Date
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // First event — incident starts
  events.push({
    time: alertStart,
    event: 'Alert triggered — incident begins',
    type: 'ALERT_START',
  })

  // Add ERROR and FATAL log events
  parsedLogs
    .filter(log => log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'WARN')
    .forEach(log => {
      events.push({
        time: log.timestamp,
        event: log.message || log.raw,
        type: log.level as TimelineEvent['type'],
      })
    })

  // Last event — incident ends
  events.push({
    time: alertEnd,
    event: 'Incident resolved',
    type: 'ALERT_END',
  })

  // Sort by timestamp
  return events.sort((a, b) => {
    if (!a.time || !b.time) return 0
    return a.time.getTime() - b.time.getTime()
  })
}