// backend/src/index.ts
import 'dotenv/config' 

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'

import stripeJsonRouter, { rawRouter as stripeRawRouter } from './routes/stripe'
import authRoutes from './routes/auth'

import adminModeratorsRoutes from './routes/adminModerators'
import animalRoutes from './routes/animals'
import uploadRoutes from './routes/upload'
import postsRoutes from './routes/posts'
import adminStatsRoutes from './routes/adminStats'
import subscriptionRoutes from './routes/subscriptionRoutes'
import paymentRouter from './routes/paymentRoutes'
import adoptionRouter from './routes/adoption'
import gpwebpayRoutes from './routes/gpwebpay'

import { prisma } from './prisma'

// ----- CORS -----
const allowed = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const corsOptions: Parameters<typeof cors>[0] = allowed.length
  ? { origin: allowed, credentials: true }
  : { origin: '*', credentials: false }

// ----- App -----
const app = express()
app.set('trust proxy', 1)

// CORS (and preflight)
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// IMPORTANT: Stripe RAW webhook FIRST (no JSON parser before this)
app.use('/api/stripe', stripeRawRouter) 

// JSON parser for the rest
app.use(express.json({ limit: '2mb' }))

// Request logger (after we parse headers, before routers)
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`)
  next()
})

// ----- Routes -----
app.use('/api/auth', authRoutes)
app.use('/api/animals', animalRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/admin', adminModeratorsRoutes)
app.use('/api/admin/stats', adminStatsRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/payments', paymentRouter)
app.use('/api/adoption', adoptionRouter)
app.use('/api/stripe', stripeJsonRouter)


app.get('/api/ping', (_req: Request, res: Response) => res.json({ ok: true }));

// GP webpay (feature flag)
const gpEnabled =
  !!process.env.GP_MERCHANT_NUMBER &&
  !!process.env.GP_GATEWAY_BASE &&
  !!process.env.GP_PRIVATE_KEY_PEM &&
  !!process.env.GP_PUBLIC_KEY_PEM

if (gpEnabled) {
  app.use('/api/gpwebpay', gpwebpayRoutes)
  console.log('✅ GP webpay routes mounted')
} else {
  console.log('⚠️ GP webpay disabled (missing env)')
}

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
  const hasStripe = !!process.env.STRIPE_SECRET_KEY || !!process.env.STRIPE_SECRET
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
const PORT = Number(process.env.PORT) || 3000
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

// ----- DB probe -----
;(async () => {
  try {
    const animals = await prisma.animal.count()
    console.log('[DB] connected. animals:', animals)
  } catch (e: any) {
    console.error('[DB probe error]', e?.message)
  }
})()