import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import incidentRoutes from './routes/incidents'
import postmortemRoutes from './routes/postmortem'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/incidents', incidentRoutes)
app.use('/api/postmortems', postmortemRoutes)

app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', message: 'Postmortem Generator API is running' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app