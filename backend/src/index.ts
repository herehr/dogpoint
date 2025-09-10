// backend/src/index.ts
import express, { Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv'
import cors, { CorsOptions } from 'cors'

import adminModeratorsRoutes from './routes/adminModerators'
import animalRoutes from './routes/animals'
import authRoutes from './routes/auth'
import uploadRoutes from './routes/upload'
import adoptionRoutes from './routes/adoption'
import postsRoutes from './routes/posts'
import { prisma } from './prisma'

dotenv.config()

// ---- CORS (typed) ----
const allowedOrigins = new Set<string>([
  'http://localhost:5173',
  'https://dogpoint-frontend-eoikq.ondigitalocean.app',
  'https://herehr.github.io',
  // add your custom domains here:
  'https://dogpoint.faktdobry.cz',
  'https://api.dogpoint.faktdobry.cz',
])

const corsOptions: CorsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // allow non-browser requests (no Origin header) and same-origin
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true)
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
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

// Base
app.get('/', (_req: Request, res: Response): void => {
  res.send('Dogpoint backend is running.')
})

// Proto (quick ping)
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

// Error handler (optional but handy)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err)
  if (err?.message?.startsWith('CORS')) {
    return res.status(403).json({ error: err.message })
  }
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`)
})