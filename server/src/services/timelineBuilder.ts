import { ParsedLog } from './logParser'

export interface TimelineEvent {
  time: string | null  // changed from Date to string
  event: string
  type: 'ALERT_START' | 'ALERT_END' | 'ERROR' | 'FATAL' | 'WARN' | 'INFO'
}

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

  parsedLogs
    .filter(log => log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'WARN')
    .forEach(log => {
      events.push({
        time: log.timestamp ? log.timestamp.toISOString() : null,
        event: log.message || log.raw,
        type: log.level as TimelineEvent['type'],
      })
    })

  events.push({
    time: alertEnd.toISOString(),
    event: 'Incident resolved',
    type: 'ALERT_END',
  })

  return events.sort((a, b) => {
    if (!a.time || !b.time) return 0
    return new Date(a.time).getTime() - new Date(b.time).getTime()
  })
}