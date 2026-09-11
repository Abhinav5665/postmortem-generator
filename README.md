# PostmortemAI 🛡️

> From outages to insights — AI-powered postmortem generation in under a minute.

When something breaks in production, the last thing engineers want to do is spend 2-3 hours writing a postmortem. PostmortemAI takes your raw logs, alert timestamps, and a quick note — and generates a complete, structured postmortem document automatically.

No templates. No manual formatting. Just paste your logs and get a professional postmortem in under a minute.

---

## ✨ Features

- **AI-generated postmortems** — from raw logs and engineer notes, powered by Google Gemini
- **Auto-built timeline** — chronological event sequence extracted directly from log timestamps
- **Automatic severity classification** — P0 / P1 / P2 determined by duration and error volume
- **Editable sections** — review and correct AI output before sharing with the team
- **Action items** — with owner tracking and completion checkboxes
- **Team tracking** — on-call engineer, incident commander, and participants
- **PDF export** — one click, print-ready document
- **Incident history** — all past incidents in one clean dashboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Docker locally / Neon for production) |
| AI | Google Gemini API |
| ORM | Prisma 7 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker Desktop
- Google Gemini API key — free at [aistudio.google.com](https://aistudio.google.com/apikey), no credit card needed

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/postmortem-generator.git
cd postmortem-generator
```

### 2. Start the database

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

### 3. Server setup

```bash
cd server
npm install
```

Create `server/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postmortem_db?sslmode=disable"
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-3.6-flash"
PORT=3001
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

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |

---

## 📖 How To Use

1. Open `http://localhost:5173`
2. Click **New Incident**
3. Enter the service name, incident start and end times
4. Paste your raw logs or upload a `.log` / `.txt` file
5. Add engineer notes — what you observed, what you tried, how it was resolved
6. Optionally add team members — on-call engineer, incident commander, participants
7. Click **Generate Postmortem** and wait 10-15 seconds
8. Review the generated document — edit any section the AI got wrong
9. Check off action items as they get resolved
10. Click **Export PDF** to download a print-ready document

---

## 📁 Project Structure

```
postmortem-generator/
├── server/
│   ├── src/
│   │   ├── routes/          # incidents and postmortems API
│   │   ├── services/        # logParser, aiService, timelineBuilder, severityScorer
│   │   ├── middleware/       # validation, file upload
│   │   └── lib/             # Prisma client singleton
│   └── prisma/
│       └── schema.prisma    # Incident and Postmortem models
│
└── client/
    └── src/
        ├── pages/           # Dashboard, NewIncident, Postmortem
        └── lib/             # Axios API client and TypeScript types
```

---

## ⚠️ Important Notes

- Make sure **Docker Desktop is open** before starting the server
- After every machine restart run `docker start postmortem-db` before `npm run dev`
- The Gemini API free tier is generous enough for development — no credit card required

---

