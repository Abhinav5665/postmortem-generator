import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import incidentRoutes from './routes/incidents'
import postmortemRoutes from './routes/postmortems'
import settingsRoutes from './routes/settings'
import authRoutes from './routes/auth'
import invitationRoutes from './routes/invitations'
import teamRoutes from './routes/team'
import { authMiddleware } from './middleware/authMiddleware'
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/api/auth', authRoutes)
app.use('/api/invitations', invitationRoutes)

app.use('/api/incidents', incidentRoutes)
app.use('/api/postmortems', postmortemRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/team', authMiddleware, teamRoutes)

app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', message: 'Postmortem Generator API is running' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app