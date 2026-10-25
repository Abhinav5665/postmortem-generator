import { ParsedLog } from './logParser'

export interface TimelineEvent {
  time: string | null
  event: string
  type: 'ALERT_START' | 'ALERT_END' | 'ERROR' | 'FATAL' | 'WARN' | 'INFO'
}

const MAX_KEY_INFO = 20      // INFO lines that describe diagnosis or fix steps
const MAX_OTHER_INFO = 5     // other INFO lines
const REPEAT_THRESHOLD = 3   // collapse a message that repeats more than this

// INFO lines that usually describe diagnosis or fix steps
const KEY_INFO_RE =
  /\b(restart\w*|roll(?:ed)?[\s-]?back|revert\w*|disabl\w+|enabl\w+|increas\w+|decreas\w+|scal(?:e|ed|ing)|restor\w+|recover\w*|resolv\w+|fix(?:ed|es)?|deploy\w*|releas\w+|appl(?:y|ied|ying)|identif\w+|found|confirm\w+|declar\w+|block\w*|revok\w+|rotat\w+|renew\w+|clear\w*|paus\w+|switch\w*|fail(?:ed)?[\s-]?over|rebalanc\w+|drain\w*|trac(?:e|ed|ing)|normal|healthy|created|added|removed|updated)\b/i

// INFO lines that are pure noise
const NOISE_RE = /\b(probe|heartbeat|keep-?alive|ping)\b/i

// Words containing digits become "#", so lines that differ only by IDs match
const normalize = (s: string) =>
  s.toLowerCase().replace(/\b\w*\d\w*\b/g, '#').replace(/\s+/g, ' ').trim()

interface Item {
  event: TimelineEvent
  sortKey: number
  order: number
  repeatKey?: string
}

export function buildTimeline(
  parsedLogs: ParsedLog[],
  alertStart: Date,
  alertEnd: Date
): TimelineEvent[] {
  const infoLogs = parsedLogs.filter(l => l.level === 'INFO')
  const isKey = (l: ParsedLog) => KEY_INFO_RE.test(l.message || l.raw)
  const isNoise = (l: ParsedLog) => NOISE_RE.test(l.message || l.raw)

  const keepInfo = new Set<ParsedLog>([
    ...infoLogs.filter(isKey).slice(0, MAX_KEY_INFO),
    ...infoLogs.filter(l => !isKey(l) && !isNoise(l)).slice(0, MAX_OTHER_INFO),
  ])

  const items: Item[] = []
  let order = 0

  items.push({
    event: { time: alertStart.toISOString(), event: 'Incident begins', type: 'ALERT_START' },
    sortKey: alertStart.getTime(),
    order: order++,
  })

  // Lines without a timestamp inherit the previous line's time, so they keep their position
  let lastKey = alertStart.getTime()

  for (const log of parsedLogs) {
    if (log.timestamp) lastKey = log.timestamp.getTime()

    const isMain = log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'WARN'
    const isInfo = log.level === 'INFO' && keepInfo.has(log)
    if (!isMain && !isInfo) continue

    const text = log.message || log.raw
    items.push({
      event: {
        time: log.timestamp ? log.timestamp.toISOString() : null,
        event: text,
        type: log.level as TimelineEvent['type'],
      },
      sortKey: lastKey,
      order: order++,
      repeatKey:
        log.level === 'ERROR' || log.level === 'WARN'
          ? `${log.level}|${normalize(text)}`
          : undefined,
    })
  }

  // Collapse heavy repeats into one row: "message (×70, last at 14:39 UTC)"
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    if (!it.repeatKey) continue
    const g = groups.get(it.repeatKey) ?? []
    g.push(it)
    groups.set(it.repeatKey, g)
  }
  const dropped = new Set<Item>()
  for (const g of groups.values()) {
    if (g.length <= REPEAT_THRESHOLD) continue
    const lastTime = g[g.length - 1].event.time
    g[0].event.event += ` (×${g.length}${lastTime ? `, last at ${lastTime.substring(11, 16)} UTC` : ''})`
    g.slice(1).forEach(it => dropped.add(it))
  }

  items.push({
    event: { time: alertEnd.toISOString(), event: 'Incident resolved', type: 'ALERT_END' },
    sortKey: alertEnd.getTime(),
    order: order++,
  })

  return items
    .filter(it => !dropped.has(it))
    .sort((a, b) => a.sortKey - b.sortKey || a.order - b.order)
    .map(it => it.event)
}