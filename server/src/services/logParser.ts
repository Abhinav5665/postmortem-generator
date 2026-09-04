export interface ParsedLog {
  timestamp: Date | null
  level: 'ERROR' | 'FATAL' | 'WARN' | 'INFO' | 'DEBUG' | 'UNKNOWN'
  message: string
  raw: string
}

export interface ParsedLogsResult {
  logs: ParsedLog[]
  errorCount: number
  fatalCount: number
  warnCount: number
  totalLines: number
}

const LOG_LEVELS = ['FATAL', 'ERROR', 'WARN', 'WARNING', 'INFO', 'DEBUG'] as const

function extractTimestamp(line: string): Date | null {
  const patterns = [
    // 2024-01-15T10:23:45.123Z
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/,
    // 2024-01-15 10:23:45
    /(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/,
    // Jan 15 10:23:45
    /([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,
    // [2024-01-15 10:23:45]
    /\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\]/,
  ]

  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (match) {
      const date = new Date(match[1])
      if (!isNaN(date.getTime())) return date
    }
  }

  return null
}

function extractLevel(line: string): ParsedLog['level'] {
  const upper = line.toUpperCase()

  for (const level of LOG_LEVELS) {
    if (upper.includes(`[${level}]`) || upper.includes(` ${level} `) || upper.includes(` ${level}:`)) {
      if (level === 'WARNING') return 'WARN'
      return level as ParsedLog['level']
    }
  }

  return 'UNKNOWN'
}

function extractMessage(line: string): string {
  // Remove timestamp
  let message = line
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/, '')
    .replace(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/, '')
    .replace(/[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/, '')
    .replace(/\[(.*?)\]/, '')

  // Remove log level
  for (const level of LOG_LEVELS) {
    message = message.replace(new RegExp(`\\b${level}\\b`, 'gi'), '')
  }

  return message.replace(/\s+/g, ' ').trim()
}

export function parseLogs(rawLogs: string): ParsedLogsResult {
  const lines = rawLogs
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const logs: ParsedLog[] = lines.map(line => ({
    timestamp: extractTimestamp(line),
    level: extractLevel(line),
    message: extractMessage(line),
    raw: line,
  }))

  // Filter out INFO and DEBUG — only keep meaningful logs
  const filteredLogs = logs.filter(log =>
    ['ERROR', 'FATAL', 'WARN', 'UNKNOWN'].includes(log.level)
  )

  // Sort by timestamp
  const sortedLogs = filteredLogs.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0
    return a.timestamp.getTime() - b.timestamp.getTime()
  })

  return {
    logs: sortedLogs,
    errorCount: logs.filter(l => l.level === 'ERROR').length,
    fatalCount: logs.filter(l => l.level === 'FATAL').length,
    warnCount: logs.filter(l => l.level === 'WARN').length,
    totalLines: lines.length,
  }
}