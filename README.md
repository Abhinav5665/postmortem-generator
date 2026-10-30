# PostmortemAI 🛡️

> From outages to insights — AI-powered postmortem generation in under a minute.

When something breaks in production, the last thing engineers want to do is spend hours writing a postmortem. PostmortemAI takes your raw logs and a quick engineer note, and generates a complete, structured postmortem document that you can review and edit before sharing.

No templates. No manual formatting. Paste your logs and get a professional draft in about 15 seconds.

---

## 🌐 Live Demo

**https://postmortem-generator-gilt.vercel.app**

| | |
|---|---|
| **Email** | `<testpostmortem@gmail.com>` |
| **Password** | `<testpostmortem>` |

This is a **member** account. You can create incidents, edit postmortems and export PDFs. Admin features (team management, Slack settings) are not available to it.

- The first load can take up to a minute, because the free hosting sleeps when idle.
- Generating a postmortem takes 15 to 60 seconds, longer if the AI provider is busy.
- All incidents in the demo are synthetic test data. Please don't enter real or sensitive logs.

### Why invitation emails are off in the live demo

The demo runs on Render's free tier, which blocks outbound SMTP ports, so the server can't send email there. Instead, when an admin invites someone, the app shows a **copy-able invitation link**. Everything else about invitations (hashed tokens, 48-hour expiry, role assignment) works the same.

### Enabling invitation emails on your own deployment

Add these to `server/.env` (or your host's environment variables). Any SMTP provider works, for example Gmail with an app password:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="you@gmail.com"
SMTP_PASS="your_app_password"
SMTP_FROM="PostmortemAI <you@gmail.com>"
```

If these are missing or sending fails, the app falls back to showing the invitation link. This needs a host that allows outbound SMTP, such as a paid Render instance, a VPS, or your local machine.

---

## ✨ Features

- **AI-generated postmortems** — summary, root cause, impact, resolution, what went well and action items, from raw logs and engineer notes
- **Incident templates** — General, Deployment, Database, Security, Performance and Infrastructure, each with its own analysis focus
- **Auto-built timeline** — chronological events from the log timestamps, including fix steps such as restarts, rollbacks and config changes
- **Impact-based severity scoring** — P0 / P1 / P2 scored by the application, not the AI, from affected users, service availability, confirmed compromise or breach, fatal errors, duration and error volume
- **Engineer override** — set severity manually; both the detected and the final value are stored and shown
- **Evidence-only AI** — the model is instructed never to invent metrics, user counts or due dates, and to answer "Not specified" when the evidence is missing
- **Reliable AI calls** — retries with backoff, a second Gemini model, then free OpenRouter models as a last-resort fallback. Output is validated with Zod before it is saved
- **Recurring incident detection** — flags services that keep failing the same way
- **Editable sections** — correct the AI output, with a full edit history
- **Action items** — with owners and completion checkboxes
- **Team tracking** — on-call engineer, incident commander and participants
- **Slack notifications** — admin-configured webhook, never sent back to the browser
- **PDF export** — print-ready layout
- **Authentication and roles** — JWT cookie login, invite-only team access, admin and member roles
- **Incident history** — dashboard with search and severity and status filters

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (local Docker or hosted, e.g. Supabase) |
| ORM | Prisma 7 |
| AI | Google Gemini, with OpenRouter as fallback |
| Validation | Zod |
| Auth | JWT in HTTP-only cookies, bcrypt |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (Docker Desktop for local, or a hosted database)
- Google Gemini API key — free at [aistudio.google.com](https://aistudio.google.com/apikey)
- Optional: OpenRouter API key for the AI fallback — free at [openrouter.ai](https://openrouter.ai)

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/postmortem-generator.git
cd postmortem-generator
```

### 2. Start the database

**Option A: local Docker**

```bash
docker run --name postmortem-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postmortem_db \
  -p 5432:5432 -d postgres
```

Already created the container before? Just start it:

```bash
docker start postmortem-db
```

**Option B: hosted database**

Create a PostgreSQL database (for example on Supabase) and use its connection string as `DATABASE_URL`.

### 3. Server setup

```bash
cd server
npm install
```

Create `server/.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postmortem_db?sslmode=disable"

# Auth
JWT_SECRET="a_long_random_string"
CLIENT_URL="http://localhost:5173"

# AI: Gemini (primary)
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-3.6-flash"
GEMINI_FALLBACK_MODEL="gemini-3.6-flash"

# AI: OpenRouter (optional last-resort fallback, comma-separated free model IDs)
OPENROUTER_API_KEY="your_openrouter_key"
OPENROUTER_MODELS="nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free"

PORT=3001
```

Invitation emails are sent by `server/src/services/emailService.ts`. Add the email settings that file reads to your `.env`.

Free OpenRouter model IDs change often. List the current ones with:

```bash
node -e "fetch('https://openrouter.ai/api/v1/models').then(r=>r.json()).then(d=>console.log(d.data.filter(m=>m.id.endsWith(':free')).map(m=>m.id).join('\n')))"
```

Push the schema and start:

```bash
npx prisma db push
npx prisma generate
npm run dev
```

### 4. Client setup

```bash
cd ../client
npm install
npm run dev
```

The client uses `http://localhost:3001/api` by default. To point it elsewhere, create `client/.env` with `VITE_API_URL=https://your-backend-url/api`.

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |

### 5. Create the admin account

Open the app. On a fresh database the login page offers **Create admin account**. The first account becomes the admin, and registration closes afterwards. The admin invites everyone else from the **Team** page.

---

## 📖 How To Use

1. Sign in and click **New Incident**
2. Enter the service name, incident type, start and end times
3. Paste your raw logs or upload a `.log` / `.txt` file
4. Add engineer notes — what you observed, what you tried, how it was resolved
5. Add team members and their roles
6. Optionally add impact details: affected users, service fully unavailable, confirmed compromise, confirmed data breach
7. Optionally override the severity (leave it on **Auto** to use the detected value)
8. Click **Generate Postmortem** and wait 10-40 seconds, longer if a fallback model is used
9. Review the document and edit any section the AI got wrong
10. Check off action items as they get resolved
11. Send it to Slack or click **Export PDF**

The log dates must match the incident start and end dates, otherwise the request is rejected.

---

## 🎯 Severity Scoring

Severity is calculated by the application, never by the AI. Points are added for each signal:

| Signal | Points |
|---|---|
| Confirmed security compromise | +8 |
| Confirmed data breach | +8 |
| Service fully unavailable | +4 |
| Fatal errors present | +5 |
| Affected users: over 10,000 / 1,000 / 100 / 50 / any | +5 / +4 / +3 / +2 / +1 |
| Duration: over 120 / 60 / 30 minutes | +4 / +2 / +1 |
| Error count: over 100 / 50 / 20 | +3 / +2 / +1 |
| Error density: over 10 / 3 per minute | +2 / +1 |

**8 or more is P0, 3 to 7 is P1, below 3 is P2.** An engineer can override the result, and the app keeps both values.

---

## 📁 Project Structure

```
postmortem-generator/
├── server/
│   ├── src/
│   │   ├── routes/          # incidents, postmortems, settings, auth, invitations, team
│   │   ├── services/        # logParser, timelineBuilder, severityScorer, aiService,
│   │   │                    # recurringDetector, slackService, emailService
│   │   ├── middleware/      # authMiddleware, validate, upload
│   │   └── lib/             # Prisma client singleton
│   └── prisma/
│       └── schema.prisma    # Incident, Postmortem, Settings, User, Invitation models
│
└── client/
    └── src/
        ├── pages/           # Dashboard, NewIncident, Postmortem, Team, Login, AcceptInvite
        ├── App.tsx          # Routes, protected layout and sidebar
        └── lib/             # Axios API client and TypeScript types
```

---

## 🔒 Security Notes

- Passwords are hashed with bcrypt; sessions use HTTP-only JWT cookies
- Invitation tokens are stored hashed and expire after 48 hours
- Login, registration and invitation endpoints are rate limited
- Only admins can invite users and change integration settings
- The Slack webhook URL is never returned to the browser, only a connected flag and the last 4 characters
- Logs and notes are sent to the configured AI providers. Free tiers may log or train on prompts, so use a paid tier with a no-training policy for real company data

---

## ⚠️ Important Notes

- Make sure **Docker Desktop is open** before starting the server (local database only)
- After every machine restart run `docker start postmortem-db` before `npm run dev`
- Free hosted databases can pause after inactivity. If you see `P1001: Can't reach database server`, check that the project is active
- Gemini's free tier sometimes returns 503 (high demand). The server retries and then falls back automatically
- Free OpenRouter models can be rate limited or removed without notice, so list more than one in `OPENROUTER_MODELS`
- If the frontend and backend are on different domains in production, set `NODE_ENV=production` and `CLIENT_URL`, so cookies use `SameSite=None; Secure`

---