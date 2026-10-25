import { parseLogs } from './src/services/logParser'

const logs = `2026-10-25 09:10:04,312 [WARNING] notify-worker: Push provider latency 2.1s
2026-10-25 09:12:18,904 [ERROR] notify-worker: Push delivery failed, provider returned 502
Traceback (most recent call last):
  File "worker.py", line 88, in send_push
    resp = provider.send(payload)
requests.exceptions.HTTPError: 502 Server Error: Bad Gateway
2026-10-25 09:15:41,120 [ERROR] notify-worker: Push delivery failed, provider returned 502
2026-10-25 09:18:03,777 [WARNING] notify-worker: Retry queue at 4000 messages
2026-10-25 09:24:30,501 [INFO] ops: Switched push traffic to backup provider
2026-10-25 09:31:12,090 [INFO] notify-worker: Retry queue drained`

for (const l of parseLogs(logs).logs) {
  console.log(l.level.padEnd(8), l.timestamp?.toISOString() ?? 'no time', '|', l.message)
}
