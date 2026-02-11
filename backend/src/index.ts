// backend/src/index.ts
import 'dotenv/config' // load env early

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'

import stripeJsonRouter, { rawRouter as stripeRawRouter } from './routes/stripe'
import authRoutes from './routes/auth'
import animalRoutes from './routes/animals'
import uploadRoutes from './routes/upload'
import postsRoutes from './routes/posts'
import adoptionRouter from './routes/adoption'
import emailTestRoutes from './routes/emailTest'
import adminModeratorsRoutes from './routes/adminModerators'
import adminStripeSyncRoutes from './routes/adminStripeSync'
import adminStatsRoutes from './routes/adminStats'
import adminAnimalStatsRoutes from './routes/adminAnimalStats'
import adminDashboardRoutes from './routes/adminDashboard'
import subscriptionRoutes from './routes/subscriptionRoutes'
import paymentRouter from './routes/paymentRoutes'
import gpwebpayRoutes from './routes/gpwebpay'
import notificationRoutes from './routes/notification'
import moderationRoutes from './routes/moderation'
import notificationTestRoutes from './routes/notificationsTest'
import taxRoutes from './routes/tax'
import taxCertificatesRoutes from './routes/taxCertificates'
import fioRoutes from './routes/fio'
import adoptionBankRoutes from './routes/adoptionBank'

import { startFioCron } from './jobs/fioCron'
import { startAdoptionBankCron } from './jobs/adoptionBankCron' // ✅ BANK TRANSFER CRON
import { prisma } from './prisma'

/* ──────────────────────────────────────────────
 * CORS
 * ──────────────────────────────────────────── */

const allowedOrigins: string[] =
  (process.env.CORS_ORIGIN || process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const corsOptions: Parameters<typeof cors>[0] = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
    if (!origin) return callback(null, true)

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    console.warn('[CORS] blocked origin:', origin)
    return callback(null, false)
  },
  credentials: true,
}

/* ──────────────────────────────────────────────
 * App
 * ──────────────────────────────────────────── */

const app = express()
app.set('trust proxy', 1)

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

/* ──────────────────────────────────────────────
 * Stripe (RAW webhook FIRST)
 * ──────────────────────────────────────────── */
app.use('/api/stripe', stripeRawRouter)

// JSON parser for everything else
app.use(express.json({ limit: '2mb' }))

// Request logger
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`)
  next()
})

/* ──────────────────────────────────────────────
 * Routes
 * ──────────────────────────────────────────── */

app.use('/api/auth', authRoutes)
app.use('/api/animals', animalRoutes)

// Stripe JSON routes AFTER body parser
app.use('/api/stripe', stripeJsonRouter)

// Adoption
app.use('/api/adoption', adoptionRouter)
app.use('/api/adoption-bank', adoptionBankRoutes)

app.use('/api/upload', uploadRoutes)
app.use('/api/posts', postsRoutes)

app.use('/api/admin/stats', adminStatsRoutes)
app.use('/api/admin/stats', adminAnimalStatsRoutes)
app.use('/api/admin/dashboard', adminDashboardRoutes)
app.use('/api/admin', adminStripeSyncRoutes)
app.use('/api/admin', adminModeratorsRoutes)

app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/payments', paymentRouter)

app.use('/api/notifications', notificationRoutes)
app.use('/api/notifications-test', notificationTestRoutes)

app.use('/api/moderation', moderationRoutes)

app.use('/api/email', emailTestRoutes)

app.use('/api/tax', taxRoutes)
app.use('/api/tax-certificates', taxCertificatesRoutes)

app.use('/api/fio', fioRoutes)

// GP WebPay (feature-flagged)
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

/* ──────────────────────────────────────────────
 * Base / Health
 * ──────────────────────────────────────────── */

app.get('/', (_req, res) => {
  res.json({ ok: true, component: 'backend' })
})

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ db: true })
  } catch (e: any) {
    res.status(500).json({ db: false, error: e?.message })
  }
})

/* ──────────────────────────────────────────────
 * Errors
 * ──────────────────────────────────────────── */

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERR]', req.method, req.originalUrl, err?.message)
  res.status(500).json({ error: 'Internal server error' })
})

/* ──────────────────────────────────────────────
 * Server + CRONS
 * ──────────────────────────────────────────── */

const PORT = Number(process.env.PORT) || 3000

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on ${PORT}`)

  // FIO import cron
  try {
    startFioCron()
  } catch (e: any) {
    console.error('[FIO CRON] failed to start', e?.message)
  }

  // ✅ BANK TRANSFER adoption cron (30d reminder / 40d deactivate)
  try {
    startAdoptionBankCron()
  } catch (e: any) {
    console.error('[ADOPTION-BANK CRON] failed to start', e?.message)
  }
})

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[${signal}] shutting down...`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))