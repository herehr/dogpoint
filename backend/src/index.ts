// backend/src/index.ts
import express, { Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import adminModeratorsRoutes from './routes/adminModerators'
import animalRoutes from './routes/animals'
import authRoutes from './routes/auth'
import uploadRoutes from './routes/upload'
import adoptionRoutes from './routes/adoption'
import postsRoutes from './routes/posts'
import { prisma } from './prisma'
import paymentsRoutes from './routes/payments'
import adminStatsRoutes from './routes/adminStats'

dotenv.config()

// ---- Wide-open CORS (development / testing) ----
const corsOptions = {
  origin: '*',          // allow all origins
  credentials: true,    // allow cookies/headers
}

// ---- App ----
const app = express()
app.use(cors(corsOptions))
app.use(express.json())

// Routes
app.use('/api/admin', adminModeratorsRoutes)
app.use('/api/animals', animalRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/adoption', adoptionRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/admin/stats', adminStatsRoutes)

// Base
app.get('/', (_req: Request, res: Response): void => {
  res.send('Dogpoint backend is running.')
})

app.get('/api/proto', (_req: Request, res: Response): void => {
  res.json({ ok: true, component: 'backend', route: '/api/proto' })
})

// Health
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', server: true })
})

app.get('/health/db', async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({ status: 'ok', db: true })
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: false, error: e.message })
  }
})



// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})