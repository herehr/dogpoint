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

const app = express()

/* ---------- Basic hardening / parsing ---------- */
app.set('trust proxy', true)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

/* ---------- CORS ---------- */
const envAllowed = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const allowedOrigins = new Set<string>([
  'http://localhost:5173',
  'https://dogpoint-frontend-eoikq.ondigitalocean.app',
  'https://herehr.github.io',
  ...envAllowed,
])

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // allow requests without Origin header (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('CORS: origin not allowed'))
  },
  credentials: true,
}
app.use(cors(corsOptions))

/* ---------- Health & base ---------- */
app.get('/', (_req: Request, res: Response) => {
  res.send('Dogpoint backend is running.')
})

app.get('/api/proto', (_req: Request, res: Response) => {
  res.json({ ok: true, component: 'backend', route: '/api/proto' })
})

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    server: true,
    env: process.env.NODE_ENV || 'development',
  })
})

app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({ status: 'ok', db: true })
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: false, error: e?.message })
  }
})

/* ---------- API routes ---------- */
app.use('/api/admin', adminModeratorsRoutes)
app.use('/api/animals', animalRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/adoption', adoptionRoutes)
app.use('/api/posts', postsRoutes)

/* ---------- 404 for unknown /api/* ---------- */
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

/* ---------- Error handler (JSON) ---------- */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err)
  const status = typeof err?.status === 'number' ? err.status : 500
  res.status(status).json({
    error: 'Internal Server Error',
    detail: process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err),
  })
})

/* ---------- Start ---------- */
const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`)
})