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

type Level = ParsedLog['level']

const LEVELS = 'FATAL|ERROR|WARNING|WARN|INFO|DEBUG'

// Level at the very start of the text: "INFO  svc: ...", "[ERROR] ...", "ERROR: ..."
const LEADING_LEVEL_RE = new RegExp(`^[\\s\\[\\(|:-]*(${LEVELS})\\b[\\]\\)]?[\\s:|-]*`, 'i')
// "... [ERROR] ..."
const BRACKET_LEVEL_RE = new RegExp(`\\[(${LEVELS})\\]`, 'i')
// "... level=error ..."
const KV_LEVEL_RE = new RegExp(`\\blevel=["']?(${LEVELS})["']?`, 'i')
// "payment-api ERROR: ..." (uppercase token within the first 4 words)
const EARLY_LEVEL_RE = new RegExp(`^((?:\\S+\\s+){0,3}?)(${LEVELS})\\b:?`)

const ISO_RE =
  /\[?(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?\s?(Z|[+-]\d{2}:?\d{2})?\]?/
const SYSLOG_RE = /\[?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\]?/

function normalizeLevel(token: string): Level {
  const t = token.toUpperCase()
  return (t === 'WARNING' ? 'WARN' : t) as Level
}

interface TimestampMatch {
  date: Date
  text: string // exact text matched, so it can be removed from the message
}

function extractTimestamp(line: string): TimestampMatch | null {
  const iso = line.match(ISO_RE)
  if (iso) {
    const [text, datePart, timePart, frac = '', tz = 'Z'] = iso
    // Timestamps without a timezone are treated as UTC (the form does the same)
    const offset = tz.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
    const date = new Date(`${datePart}T${timePart}${frac}${offset}`)
    if (!isNaN(date.getTime())) return { date, text }
  }

  const sys = line.match(SYSLOG_RE)
  if (sys) {
    const [text, mon, day, time] = sys
    // Syslog lines have no year, so assume the current one (UTC)
    const date = new Date(`${mon} ${day} ${new Date().getUTCFullYear()} ${time} UTC`)
    if (!isNaN(date.getTime())) return { date, text }
  }

  return null
}

function extractLevel(text: string): { level: Level; message: string } {
  let m = text.match(LEADING_LEVEL_RE)
  if (m) return { level: normalizeLevel(m[1]), message: text.slice(m[0].length) }

  m = text.match(BRACKET_LEVEL_RE)
  if (m) return { level: normalizeLevel(m[1]), message: text.replace(m[0], ' ') }

  m = text.match(KV_LEVEL_RE)
  if (m) return { level: normalizeLevel(m[1]), message: text.replace(m[0], ' ') }

  m = text.match(EARLY_LEVEL_RE)
  if (m) return { level: normalizeLevel(m[2]), message: m[1] + text.slice(m[0].length) }

  return { level: 'UNKNOWN', message: text }
}

function cleanMessage(message: string): string {
  return message.replace(/\s+/g, ' ').replace(/^[\s:|-]+/, '').trim()
}

function parseLine(line: string): ParsedLog {
  const ts = extractTimestamp(line)
  const rest = (ts ? line.replace(ts.text, ' ') : line).trim()
  const { level, message } = extractLevel(rest)

  return {
    timestamp: ts ? ts.date : null,
    level,
    message: cleanMessage(message),
    raw: line,
  }
}

export function parseLogs(rawLogs: string): ParsedLogsResult {
  const lines = rawLogs
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const parsed = lines.map(parseLine)

  // Sort by time. Lines without a timestamp (stack traces, continuation lines)
  // inherit the previous line's time, so they stay next to their parent line.
  let lastTime = 0
  const keyed = parsed.map((log, index) => {
    if (log.timestamp) lastTime = log.timestamp.getTime()
    return { log, index, key: lastTime }
  })

  // Keep everything except DEBUG. INFO is kept because it often holds the fix
  // steps; the AI prompt and the timeline builder choose what they need.
  const logs = keyed
    .filter(k => k.log.level !== 'DEBUG')
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map(k => k.log)

  return {
    logs,
    errorCount: parsed.filter(l => l.level === 'ERROR').length,
    fatalCount: parsed.filter(l => l.level === 'FATAL').length,
    warnCount: parsed.filter(l => l.level === 'WARN').length,
    totalLines: lines.length,
  }
}