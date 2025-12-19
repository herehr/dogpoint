// backend/src/routes/adminStats.ts
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { Role, PaymentStatus as PS, ContentStatus } from '@prisma/client'

const router = Router()

/**
 * IMPORTANT
 * - Keep KPI overview on GET /api/admin/stats
 * - Add details endpoints under /payments /pledges /expected
 * - Only ADMIN / MODERATOR may access (auth required)
 */

const BUILD = 'dev-adminStats-2025-12-19-1118'

// ───────────────────────────────────────────────────────────────
// Debug endpoints (no auth)
// ───────────────────────────────────────────────────────────────
router.get('/_ping', (_req, res) => {
  res.json({ ok: true, where: 'adminStats router mounted' })
})

router.get('/_version', (_req, res) => {
  res.json({ ok: true, build: BUILD })
})

// ───────────────────────────────────────────────────────────────
// Role guard
// ───────────────────────────────────────────────────────────────
function requireAdminOrModerator(req: Request, res: Response, next: NextFunction) {
  const r = (req as any).user?.role
  if (r === Role.ADMIN || r === Role.MODERATOR || r === 'ADMIN' || r === 'MODERATOR') return next()
  return res.status(403).json({ error: 'Forbidden' })
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function parseDate(input?: string | null): Date | undefined {
  if (!input) return undefined
  const d = new Date(input)
  return isNaN(d.getTime()) ? undefined : d
}
type Range = { gte?: Date; lt?: Date }

function normalizeRange(q: any): Range | undefined {
  const from = parseDate(typeof q.from === 'string' ? q.from : undefined)
  const to = parseDate(typeof q.to === 'string' ? q.to : undefined)
  if (!from && !to) return undefined
  const r: Range = {}
  if (from) r.gte = from
  if (to) r.lt = to
  return r
}

// ALL endpoints below require auth + role
router.use(requireAuth, requireAdminOrModerator)

// ───────────────────────────────────────────────────────────────
// 0) KPI OVERVIEW (keeps your existing functionality)
// GET /api/admin/stats
// ───────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      usersTotal,
      usersDonors,
      animalsActive,
      animalsPending,
      postsPublished,
      postsPending,
      pledgesPending,
      paymentsPaidThisMonth,
      paymentsPaidLastMonth,
      subsActive,
      subsPending,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          OR: [{ subscriptions: { some: {} } }],
        },
      }),
      prisma.animal.count({
        where: { active: true, status: ContentStatus.PUBLISHED },
      }),
      prisma.animal.count({
        where: { active: true, status: ContentStatus.PENDING_REVIEW },
      }),
      prisma.post.count({
        where: { active: true, status: ContentStatus.PUBLISHED },
      }),
      prisma.post.count({
        where: { active: true, status: ContentStatus.PENDING_REVIEW },
      }),
      prisma.pledge.count({
        where: { status: PS.PENDING },
      }),
      prisma.payment.aggregate({
        where: {
          status: PS.PAID,
          paidAt: { gte: startOfThisMonth },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: PS.PAID,
          paidAt: { gte: startOfLastMonth, lt: startOfThisMonth },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' as any } }),
      prisma.subscription.count({ where: { status: 'PENDING' as any } }),
    ])

    const expectedMonthly = await prisma.subscription.aggregate({
      where: { status: 'ACTIVE' as any },
      _sum: { monthlyAmount: true },
    })

    res.json({
      ok: true,
      users: {
        total: usersTotal,
        donorsApprox: usersDonors,
      },
      content: {
        animalsActive,
        animalsPending,
        postsPublished,
        postsPending,
      },
      money: {
        expectedMonthlyCZK: expectedMonthly._sum.monthlyAmount || 0,
        paidThisMonthCZK: paymentsPaidThisMonth._sum.amount || 0,
        paidThisMonthCount: paymentsPaidThisMonth._count._all || 0,
        paidLastMonthCZK: paymentsPaidLastMonth._sum.amount || 0,
        paidLastMonthCount: paymentsPaidLastMonth._count._all || 0,
      },
      flow: {
        pledgesPending,
        subscriptionsActive: subsActive,
        subscriptionsPending: subsPending,
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/stats error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 1) PAYMENTS (Detaily)
// GET /api/admin/stats/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
// ───────────────────────────────────────────────────────────────
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)
    const filter = range ? { createdAt: range } : {}

    const [subPayments, pledgePayments] = await Promise.all([
      prisma.payment.findMany({
        where: filter as any,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: {
              user: { select: { email: true } },
              animal: { select: { id: true, jmeno: true, name: true } },
            },
          },
        },
      }),
      prisma.pledgePayment.findMany({
        where: filter as any,
        orderBy: { createdAt: 'desc' },
        include: { pledge: true },
      }),
    ])

    const rows = [
      ...subPayments.map((p) => ({
        id: p.id,
        source: 'subscription' as const,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: String(p.provider ?? ''),
        createdAt: p.createdAt,
        userEmail: p.subscription?.user?.email ?? null,
        animalId: p.subscription?.animalId ?? null,
        animalName: p.subscription?.animal?.jmeno || p.subscription?.animal?.name || null,
      })),
      ...pledgePayments.map((pp) => ({
        id: pp.id,
        source: 'pledge' as const,
        amount: pp.amount,
        currency: pp.currency || 'CZK',
        status: pp.status,
        provider: pp.provider ?? 'fio',
        createdAt: pp.createdAt,
        userEmail: pp.pledge?.email ?? null,
        animalId: pp.pledge?.animalId ?? null,
        animalName: null,
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

    const total = rows.reduce((s, r) => s + (r.status === PS.PAID ? r.amount : 0), 0)

    res.json({ ok: true, count: rows.length, total, rows })
  } catch (e: any) {
    console.error('GET /api/admin/stats/payments error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 2) PLEDGES (Detaily)
// GET /api/admin/stats/pledges?from=YYYY-MM-DD&to=YYYY-MM-DD
// ───────────────────────────────────────────────────────────────
router.get('/pledges', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)
    const where = range ? { createdAt: range } : {}

    const pledges = await prisma.pledge.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    })

    const count = pledges.length
    const sum = pledges.reduce((s, p: any) => s + (p.amount || 0), 0)

    const byStatus: Record<string, { count: number; sum: number }> = {}
    for (const p of pledges as any[]) {
      const key = String(p.status)
      byStatus[key] = byStatus[key] || { count: 0, sum: 0 }
      byStatus[key].count += 1
      byStatus[key].sum += p.amount || 0
    }

    res.json({ ok: true, count, sum, byStatus, rows: pledges })
  } catch (e: any) {
    console.error('GET /api/admin/stats/pledges error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 3) EXPECTED (Detaily)
// GET /api/admin/stats/expected?from=YYYY-MM-DD&to=YYYY-MM-DD
// ───────────────────────────────────────────────────────────────
router.get('/expected', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)

    let fromD = range?.gte
    let toD = range?.lt
    if (!fromD || !toD) {
      const now = new Date()
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      fromD = fromD ?? start
      toD = toD ?? end
    }

    const subs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: { lt: toD },
        OR: [{ canceledAt: null }, { canceledAt: { gte: fromD } }],
      },
      select: {
        id: true,
        monthlyAmount: true,
        currency: true,
        user: { select: { email: true } },
        animal: { select: { id: true, jmeno: true, name: true } },
      },
    })

    const totalMonthly = subs
      .filter((s) => s.currency === 'CZK')
      .reduce((s, r) => s + (r.monthlyAmount || 0), 0)

    res.json({
      ok: true,
      period: { from: fromD, to: toD },
      activeCount: subs.length,
      totalMonthly,
      rows: subs.map((s) => ({
        id: s.id,
        monthlyAmount: s.monthlyAmount,
        currency: s.currency,
        userEmail: s.user?.email ?? null,
        animalId: s.animal?.id ?? null,
        animalName: s.animal?.jmeno || s.animal?.name || null,
      })),
    })
  } catch (e: any) {
    console.error('GET /api/admin/stats/expected error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

export default router