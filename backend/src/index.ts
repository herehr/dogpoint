// backend/src/index.ts
import express, { Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv'
import cors, { type CorsOptions } from 'cors'

// Route modules
import adminModeratorsRoutes from './routes/adminModerators'
import animalRoutes from './routes/animals'
import authRoutes from './routes/auth'
import uploadRoutes from './routes/upload'
import postsRoutes from './routes/posts'
import adminStatsRoutes from './routes/adminStats'
import subscriptionRoutes from './routes/subscriptionRoutes'
// Keep ONE payments router mounted:
import paymentRouter from './routes/paymentRoutes'
// import paymentsRoutes from './routes/payments' // <- do NOT mount both

import adoptionRouter from './routes/adoption'
import { prisma } from './prisma'

dotenv.config()

// ----- CORS -----
const allowed = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const corsOptions: CorsOptions = allowed.length
  ? { origin: allowed, credentials: true }
  : { origin: '*', credentials: false } // fallback for dev-only

// ----- App -----
const app = express()
app.set('trust proxy', 1)
app.use(cors(corsOptions))
app.use(express.json({ limit: '2mb' }))

// Optional: simple request logger (helpful for 500s)
app.use((req, _res, next) => {
  const role = (req as any).user?.role
  console.log(`[REQ] ${req.method} ${req.originalUrl} ${role ? `(role=${role})` : ''}`)
  next()
})

// ----- Routes -----
app.use('/api/admin', adminModeratorsRoutes)
app.use('/api/animals', animalRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/admin/stats', adminStatsRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
// Mount exactly one payments router:
app.use('/api/payments', paymentRouter)
// app.use('/api/payments', paymentsRoutes) // <- use this instead of the line above if you prefer the old router
app.use('/api/adoption', adoptionRouter)

// ----- Base -----
app.get('/', (_req: Request, res: Response) => {
  res.json({ ok: true, component: 'backend', root: '/' })
})

app.get('/api/proto', (_req: Request, res: Response) => {
  res.json({ ok: true, component: 'backend', route: '/api/proto' })
})

// ----- Health -----
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', server: true })
})

app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({ status: 'ok', db: true })
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: false, error: e?.message })
  }
})

app.get('/health/stripe', (_req, res) => {
  const hasStripe = !!process.env.STRIPE_SECRET_KEY || !!process.env.STRIPE_API_KEY
  res.json({ stripe: hasStripe })
})

// ----- 404 -----
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl })
})

// ----- Error handler -----
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERR]', {
    route: req.originalUrl,
    method: req.method,
    message: err?.message,
    code: err?.code,
    meta: err?.meta,
    stack: err?.stack,
  })
  res.status(500).json({ error: 'Internal server error' })
})

// ----- Server -----
const PORT = Number(process.env.PORT) || 8080
const HOST = '0.0.0.0'

const server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`)
})

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[${signal}] shutting down...`)
  server.close(async () => {
    try {
      await prisma.$disconnect()
    } finally {
      process.exit(0)
    }
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))