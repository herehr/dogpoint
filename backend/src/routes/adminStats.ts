import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'

// --- simple guard (adjust if you have a shared middleware) ---
function requireAdmin(req: Request, res: Response, next: Function) {
  const u: any = (req as any).user
  if (!u || (u.role !== 'ADMIN' && u.role !== 'MODERATOR')) { // allow MODERATOR to preview if you want
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

type CommonFilters = {
  from?: Date
  to?: Date
}

function normalizeRange(q: any): CommonFilters {
  const from = parseDate(q.from)
  const to = parseDate(q.to)
  return { from, to }
}

// 1) PAYMENTS: list + totals (Payment + PledgePayment)
router.get('/payments', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { from, to } = normalizeRange(req.query)

    const whereCommon: any = {}
    if (from) whereCommon.createdAt = Object.assign(whereCommon.createdAt ?? {}, { gte: from })
    if (to) whereCommon.createdAt = Object.assign(whereCommon.createdAt ?? {}, { lt: to })

    const [subPayments, pledgePayments] = await Promise.all([
      prisma.payment.findMany({
        where: whereCommon,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: {
              user: { select: { email: true } },
              animal: { select: { id: true, jmeno: true, name: true } }
            }
          }
        }
      }),
      prisma.pledgePayment.findMany({
        where: whereCommon,
        orderBy: { createdAt: 'desc' },
        include: {
          pledge: true
        }
      })
    ])

    // unify shape
    const rows = [
      ...subPayments.map(p => ({
        id: p.id,
        source: 'subscription' as const,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        createdAt: p.createdAt,
        userEmail: p.subscription?.user?.email ?? null,
        animalId: p.subscription?.animalId ?? null,
        animalName: p.subscription?.animal?.jmeno || p.subscription?.animal?.name || null
      })),
      ...pledgePayments.map(pp => ({
        id: pp.id,
        source: 'pledge' as const,
        amount: pp.amount,
        currency: 'CZK',
        status: pp.status,
        provider: (pp.provider ?? 'fio') as any,
        createdAt: pp.createdAt,
        userEmail: pp.pledge?.email ?? null,
        animalId: pp.pledge?.animalId ?? null,
        animalName: null
      }))
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

    const total = rows.reduce((s, r) => s + (r.status === 'PAID' || r.status === 'SUCCEEDED' ? r.amount : 0), 0)
    const count = rows.length

    res.json({ ok: true, count, total, rows })
  } catch (e: any) {
    console.error('GET /api/admin/stats/payments error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

// 2) PLEDGES: all promises (count + sum)
router.get('/pledges', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { from, to } = normalizeRange(req.query)
    const where: any = {}
    if (from) where.createdAt = Object.assign(where.createdAt ?? {}, { gte: from })
    if (to) where.createdAt = Object.assign(where.createdAt ?? {}, { lt: to })

    const pledges = await prisma.pledge.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    const count = pledges.length
    const sum = pledges.reduce((s, p) => s + (p.amount || 0), 0)

    // status buckets
    const byStatus: Record<string, { count: number; sum: number }> = {}
    for (const p of pledges) {
      const key = p.status
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

// 3) EXPECTED: Recurring expected amounts from ACTIVE subscriptions
//    Simple model: expected for the period = sum of monthlyAmount for subscriptions ACTIVE at any point within [from,to).
router.get('/expected', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { from, to } = normalizeRange(req.query)

    // If no range, default to "this month"
    let fromD = from
    let toD = to
    if (!fromD || !toD) {
      const now = new Date()
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      fromD = fromD ?? start
      toD = toD ?? end
    }

    // Subscriptions that were ACTIVE at any time in the window
    // (status ACTIVE and (startedAt < to) and (canceledAt is null or canceledAt >= from))
    const subs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: { lt: toD },
        OR: [{ canceledAt: null }, { canceledAt: { gte: fromD } }]
      },
      select: {
        id: true,
        monthlyAmount: true,
        currency: true,
        user: { select: { email: true } },
        animal: { select: { id: true, jmeno: true, name: true } }
      }
    })

    const totalMonthly = subs.reduce((s, r) => s + (r.monthlyAmount || 0), 0)

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
        animalName: s.animal?.jmeno || s.animal?.name || null
      }))
    })
  } catch (e: any) {
    console.error('GET /api/admin/stats/expected error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

export default router