# PostmortemAI 🛡️

> From outages to insights — AI-powered postmortem generation in under a minute.

When something breaks in production, the last thing engineers want to do is spend 2-3 hours writing a postmortem. PostmortemAI takes your raw logs, alert timestamps, and a quick note — and generates a complete, structured postmortem document automatically.

---

## ✨ Features

- **AI-generated postmortems** from raw logs and engineer notes
- **Auto-built timeline** from log timestamps
- **Automatic severity classification** — P0 / P1 / P2
- **Editable sections** — review and correct AI output before sharing
- **Action items** with owner tracking and completion status
- **Team tracking** — on-call engineer, incident commander, participants
- **PDF export** — one click, print-ready document
- **Incident history** — all past incidents in one dashboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Docker / Neon) |
| AI | Google Gemini API |
| ORM | Prisma 7 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker Desktop
- Gemini API key — free at [aistudio.google.com](https://aistudio.google.com/apikey)

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

Push schema and start:

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
| Backend | http://localhost:3001 |

---

## 📖 How To Use

1. Open `http://localhost:5173`
2. Click **New Incident**
3. Enter service name, start and end times
4. Paste raw logs or upload a `.log` / `.txt` file
5. Add engineer notes and team members
6. Click **Generate Postmortem**
7. Review, edit sections, check off action items
8. Click