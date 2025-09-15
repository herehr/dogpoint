// backend/src/routes/adminStats.ts
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt' // must set req.user = { id, role, ... }
import { PaymentStatus as PS } from '@prisma/client' // enum from Prisma

// --- allow Admin (and optionally Moderator) ---
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u: any = (req as any).user
  if (!u || (u.role !== 'ADMIN' && u.role !== 'MODERATOR')) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

const router = Router()

// Helpers
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

// All routes below require a valid JWT and admin/mod role
router.use(requireAuth, requireAdmin)

/**
 * 1) PAYMENTS: list + totals (Subscription Payment + PledgePayment)
 * GET /api/admin/stats/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)
    const createdAtFilter = range ? { createdAt: range } : {}

    const [subPayments, pledgePayments] = await Promise.all([
      prisma.payment.findMany({
        where: createdAtFilter as any,
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
        where: createdAtFilter as any,
        orderBy: { createdAt: 'desc' },
        include: { pledge: true },
      }),
    ])

    type Row = {
      id: string
      source: 'subscription' | 'pledge'
      amount: number
      currency: string
      status: PS
      provider: string | null
      createdAt: Date
      userEmail: string | null
      animalId: string | null
      animalName: string | null
    }

    // unify shape
    const rows: Row[] = [
      ...subPayments.map<Row>(p => ({
        id: p.id,
        source: 'subscription',
        amount: p.amount,
        currency: p.currency,
        status: p.status,             // PS enum
        provider: String(p.provider ?? ''),
        createdAt: p.createdAt,
        userEmail: p.subscription?.user?.email ?? null,
        animalId: p.subscription?.animalId ?? null,
        animalName: p.subscription?.animal?.jmeno || p.subscription?.animal?.name || null,
      })),
      ...pledgePayments.map<Row>(pp => ({
        id: pp.id,
        source: 'pledge',
        amount: pp.amount,
        currency: 'CZK',
        status: pp.status,            // PS enum
        provider: pp.provider ?? 'fio',
        createdAt: pp.createdAt,
        userEmail: pp.pledge?.email ?? null,
        animalId: pp.pledge?.animalId ?? null,
        animalName: null,
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

    
// treat only fully paid as settled; refunded/failed/canceled are excluded
    const isSettled = (s: PS) => s === PS.PAID
    const total = rows.reduce((s, r) => s + (isSettled(r.status) ? r.amount : 0), 0)
    const count = rows.length

    res.json({ ok: true, count, total, rows })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('GET /api/admin/stats/payments error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

/**
 * 2) PLEDGES: all promises (count + sum + buckets)
 * GET /api/admin/stats/pledges?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/pledges', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)
    const where = range ? { createdAt: range } : {}

    const pledges = await prisma.pledge.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    })

    const count = pledges.length
    const sum = pledges.reduce((s, p) => s + (p.amount || 0), 0)

    const byStatus: Record<string, { count: number; sum: number }> = {}
    for (const p of pledges) {
      const key = p.status
      byStatus[key] = byStatus[key] || { count: 0, sum: 0 }
      byStatus[key].count += 1
      byStatus[key].sum += p.amount || 0
    }

    res.json({ ok: true, count, sum, byStatus, rows: pledges })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('GET /api/admin/stats/pledges error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

/**
 * 3) EXPECTED: recurring expected amounts from ACTIVE subscriptions
 * GET /api/admin/stats/expected?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/expected', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)

    // default to "this month" if not provided
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
      .filter(s => s.currency === 'CZK')
      .reduce((s, r) => s + (r.monthlyAmount || 0), 0)

    res.json({
      ok: true,
      period: { from: fromD, to: toD },
      activeCount: subs.length,
      totalMonthly,
      rows: subs.map(s => ({
        id: s.id,
        monthlyAmount: s.monthlyAmount,
        currency: s.currency,
        userEmail: s.user?.email ?? null,
        animalId: s.animal?.id ?? null,
        animalName: s.animal?.jmeno || s.animal?.name || null,
      })),
    })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('GET /api/admin/stats/expected error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

export default router