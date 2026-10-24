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
  const keyed: { event: TimelineEvent; sortKey: number; order: number }[] = []
  let order = 0

  keyed.push({
    event: { time: alertStart.toISOString(), event: 'Incident begins', type: 'ALERT_START' },
    sortKey: alertStart.getTime(),
    order: order++,
  })

  // Lines without a timestamp inherit the time of the line before them,
  // so they stay in their original position instead of sinking to the end
  let lastKey = alertStart.getTime()
  let infoCount = 0

  for (const log of parsedLogs) {
    if (log.timestamp) lastKey = log.timestamp.getTime()

    const isMain = log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'WARN'
    const isInfo = log.level === 'INFO' && infoCount < MAX_INFO_EVENTS
    if (!isMain && !isInfo) continue
    if (isInfo) infoCount++

    keyed.push({
      event: {
        time: log.timestamp ? log.timestamp.toISOString() : null,
        event: log.message || log.raw,
        type: log.level as TimelineEvent['type'],
      },
      sortKey: lastKey,
      order: order++,
    })
  }

  keyed.push({
    event: { time: alertEnd.toISOString(), event: 'Incident resolved', type: 'ALERT_END' },
    sortKey: alertEnd.getTime(),
    order: order++,
  })

  return keyed
    .sort((a, b) => a.sortKey - b.sortKey || a.order - b.order)
    .map(k => k.event)
}