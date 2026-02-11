// backend/src/routes/adminStats.ts
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import {
  Role,
  PaymentStatus as PS,
  ContentStatus,
  SubscriptionStatus,
} from '@prisma/client'

const router = Router()

/**
 * IMPORTANT
 * - Keep KPI overview on GET /api/admin/stats
 * - Add details endpoints under /payments /pledges /expected
 * - Only ADMIN / MODERATOR may access (auth required)
 */

const BUILD = 'dev-adminStats-2026-02-03'

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

function csvEscape(v: any) {
  const s = String(v ?? '')
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ALL endpoints below require auth + role
router.use(requireAuth, requireAdminOrModerator)

// ───────────────────────────────────────────────────────────────
// 0) KPI OVERVIEW
// GET /api/admin/stats
// ───────────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
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
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.PENDING } }),
    ])

    const expectedMonthly = await prisma.subscription.aggregate({
      where: { status: SubscriptionStatus.ACTIVE },
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
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          createdAt: true,
          subscription: {
            select: {
              animalId: true,
              user: { select: { email: true } },
              animal: { select: { jmeno: true, name: true } },
            },
          },
        },
      }),
      prisma.pledgePayment.findMany({
        where: filter as any,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          createdAt: true,
          pledge: { select: { email: true, animalId: true } },
        },
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

    const total = rows.reduce((s, r) => s + (String(r.status || '').toUpperCase() === 'PAID' ? (r.amount ?? 0) : 0), 0)

    res.json({ ok: true, count: rows.length, total, rows })
  } catch (e: any) {
    console.error('GET /api/admin/stats/payments error', e)
    const msg = e?.message || String(e)
    res.status(500).json({ error: 'internal error', detail: msg })
  }
})

// ───────────────────────────────────────────────────────────────
// 2) PLEDGES (Detaily)
// GET /api/admin/stats/pledges?from=YYYY-MM-DD&to=YYYY-MM-DD
// ───────────────────────────────────────────────────────────────
router.get('/pledges', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)

    // ✅ only pending pledges
    const where: any = { status: PS.PENDING }
    if (range) where.createdAt = range

    const [rows, agg] = await Promise.all([
      prisma.pledge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          email: true,
          animalId: true,
          amount: true,
          status: true,
          method: true,
          interval: true,
          providerId: true,
        },
      }),
      prisma.pledge.aggregate({
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ])

    res.json({
      ok: true,
      count: agg._count._all || 0,
      sum: agg._sum.amount || 0,
      rows,
      byStatus: { PENDING: { count: agg._count._all || 0, sum: agg._sum.amount || 0 } },
    })
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
        status: SubscriptionStatus.ACTIVE,
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

// ───────────────────────────────────────────────────────────────
// 4) ANIMALS aggregation (for your "Zvířata" tab)
// GET /api/admin/stats/animals
// ───────────────────────────────────────────────────────────────
router.get('/animals', async (_req: Request, res: Response) => {
  try {
    const animals = await prisma.animal.findMany({
      where: { active: true },
      select: { id: true, jmeno: true, name: true },
      orderBy: [{ jmeno: 'asc' }, { name: 'asc' }],
    })

    const animalIds = animals.map((a) => a.id)
    if (animalIds.length === 0) return res.json({ ok: true, count: 0, rows: [] })

    // active subs (ACTIVE) -> donorsActive + monthlyActiveSum
    const activeSubs = await prisma.subscription.findMany({
      where: { animalId: { in: animalIds }, status: SubscriptionStatus.ACTIVE },
      select: { animalId: true, monthlyAmount: true, userId: true },
    })

    // paid subscription payments
    const paidSubPayments = await prisma.payment.findMany({
      where: {
        status: PS.PAID,
        subscription: { animalId: { in: animalIds } },
      },
      select: { amount: true, subscription: { select: { animalId: true } } },
    })

    // paid pledge payments (pledges have animalId)
    const paidPledgePayments = await prisma.pledgePayment.findMany({
      where: {
        status: PS.PAID,
        pledge: { animalId: { in: animalIds } },
      },
      select: { amount: true, pledge: { select: { animalId: true } } },
    })

    const byAnimal: Record<
      string,
      {
        donorsActive: Set<string>
        monthlyActiveSum: number
        paidSumSubscriptions: number
        paidSumPledges: number
      }
    > = {}

    for (const a of animalIds) {
      byAnimal[a] = {
        donorsActive: new Set<string>(),
        monthlyActiveSum: 0,
        paidSumSubscriptions: 0,
        paidSumPledges: 0,
      }
    }

    for (const s of activeSubs) {
      byAnimal[s.animalId]?.donorsActive.add(s.userId)
      byAnimal[s.animalId]!.monthlyActiveSum += s.monthlyAmount || 0
    }

    for (const p of paidSubPayments) {
      const aid = p.subscription?.animalId
      if (!aid) continue
      byAnimal[aid]!.paidSumSubscriptions += p.amount || 0
    }

    for (const pp of paidPledgePayments) {
      const aid = pp.pledge?.animalId
      if (!aid) continue
      byAnimal[aid]!.paidSumPledges += pp.amount || 0
    }

    const rows = animals.map((a) => {
      const agg = byAnimal[a.id]
      const paidSumTotal = (agg?.paidSumSubscriptions || 0) + (agg?.paidSumPledges || 0)
      return {
        animalId: a.id,
        animalName: a.jmeno || a.name || a.id,
        donorsActive: agg ? agg.donorsActive.size : 0,
        monthlyActiveSum: agg?.monthlyActiveSum || 0,
        paidSumSubscriptions: agg?.paidSumSubscriptions || 0,
        paidSumPledges: agg?.paidSumPledges || 0,
        paidSumTotal,
      }
    })

    res.json({ ok: true, count: rows.length, rows })
  } catch (e: any) {
    console.error('GET /api/admin/stats/animals error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 5) ADOPTIONS OVERVIEW (promised vs cashed)
// GET /api/admin/stats/adoptions/overview
// ───────────────────────────────────────────────────────────────
router.get('/adoptions/overview', async (_req: Request, res: Response) => {
  try {
    const promisedWhere = {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
    }

    const [promisedCount, promisedAgg, paidAgg, paidCount] = await Promise.all([
      prisma.subscription.count({ where: promisedWhere }),
      prisma.subscription.aggregate({ where: promisedWhere, _sum: { monthlyAmount: true } }),
      prisma.payment.aggregate({ where: { status: PS.PAID }, _sum: { amount: true } }),
      prisma.payment.count({ where: { status: PS.PAID } }),
    ])

    return res.json({
      ok: true,
      promised: {
        count: promisedCount,
        monthlySumCZK: promisedAgg._sum.monthlyAmount || 0,
      },
      cashed: {
        count: paidCount,
        sumCZK: paidAgg._sum.amount || 0,
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/stats/adoptions/overview error', e)
    return res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 6) CSV EXPORT (frontend expects this exact endpoint)
// GET /api/admin/stats/adoptions/export.csv
// ───────────────────────────────────────────────────────────────
router.get('/adoptions/export.csv', async (_req: Request, res: Response) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
      },
      include: {
        user: true,
        animal: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const header = [
      'email',
      'firstName',
      'lastName',
      'street',
      'streetNo',
      'zip',
      'city',
      'animal',
      'status',
      'monthlyAmount',
      'currency',
      'provider',
      'variableSymbol',
      'createdAt',
    ].join(';')

    const lines: string[] = [header]

    for (const r of subs) {
      const animalName = r.animal?.jmeno || r.animal?.name || r.animal?.id || ''
      lines.push(
        [
          csvEscape(r.user?.email),
          csvEscape(r.user?.firstName),
          csvEscape(r.user?.lastName),
          csvEscape(r.user?.street),
          csvEscape(r.user?.streetNo),
          csvEscape(r.user?.zip),
          csvEscape(r.user?.city),
          csvEscape(animalName),
          csvEscape(r.status),
          csvEscape(r.monthlyAmount),
          csvEscape(r.currency),
          csvEscape(r.provider),
          csvEscape(r.variableSymbol),
          csvEscape(r.createdAt?.toISOString?.() ? r.createdAt.toISOString() : r.createdAt),
        ].join(';')
      )
    }

    // ✅ UTF-8 with BOM for Excel compatibility
    const csv = '\uFEFF' + lines.join('\n')
    const today = new Date().toISOString().slice(0, 10)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="dogpoint-adopce-${today}.csv"`)
    return res.status(200).send(csv)
  } catch (e: any) {
    console.error('GET /api/admin/stats/adoptions/export.csv error', e)
    return res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 7) OPTIONAL LEGACY CSV EXPORT (keep if you still use it somewhere)
// GET /api/admin/stats/adopters.csv
// ───────────────────────────────────────────────────────────────
router.get('/adopters.csv', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        street: true,
        streetNo: true,
        zip: true,
        city: true,
        subscriptions: {
          where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] } },
          select: {
            monthlyAmount: true,
            status: true,
            animal: { select: { id: true, jmeno: true, name: true } },
          },
        },
      },
    })

    const header = [
      'email',
      'firstName',
      'lastName',
      'street',
      'streetNo',
      'zip',
      'city',
      'adoptedAnimals',
      'adoptionsCount',
      'monthlySumCZK',
    ].join(';')

    const lines: string[] = [header]

    for (const u of users) {
      const subs = (u.subscriptions || []).filter(Boolean)
      if (!subs.length) continue // export only donors

      const animals = subs
        .map((s) => s.animal?.jmeno || s.animal?.name || s.animal?.id || '')
        .filter(Boolean)

      const monthlySum = subs.reduce((sum, s) => sum + (s.monthlyAmount || 0), 0)

      const row = [
        csvEscape(u.email),
        csvEscape(u.firstName),
        csvEscape(u.lastName),
        csvEscape(u.street),
        csvEscape(u.streetNo),
        csvEscape(u.zip),
        csvEscape(u.city),
        csvEscape(animals.join(' | ')),
        csvEscape(subs.length),
        csvEscape(monthlySum),
      ].join(';')

      lines.push(row)
    }

    // ✅ UTF-8 with BOM for Excel compatibility
    const csv = '\uFEFF' + lines.join('\n')
    const today = new Date().toISOString().slice(0, 10)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="dogpoint-adopters-${today}.csv"`)
    return res.status(200).send(csv)
  } catch (e: any) {
    console.error('GET /api/admin/stats/adopters.csv error', e)
    return res.status(500).json({ error: 'internal error' })
  }
})

export default router