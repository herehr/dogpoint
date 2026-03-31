// backend/src/routes/adminStats.ts
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma'
import { requireAuth, requireAdmin } from '../middleware/authJwt'
import { runRepairImport } from '../services/repairImportPayments'
import {
  Role,
  PaymentStatus as PS,
  ContentStatus,
  SubscriptionStatus,
  PaymentProvider,
  ShareInviteStatus,
} from '@prisma/client'

const router = Router()

/**
 * IMPORTANT
 * - Keep KPI overview on GET /api/admin/stats
 * - Add details endpoints under /payments /pledges /expected
 * - Only ADMIN / MODERATOR may access (auth required)
 */

const BUILD = 'dev-adminStats-2026-02-03'

// Stats: only FIO + STRIPE with in_ (invoice id), exclude cs_ (checkout session)
const statsPaymentWhere = {
  OR: [
    { provider: PaymentProvider.FIO },
    { provider: PaymentProvider.STRIPE, providerRef: { startsWith: 'in_' } },
  ],
}

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

type SubscriptionExportRow = {
  email: string | null
  firstName: string | null
  lastName: string | null
  street: string | null
  streetNo: string | null
  zip: string | null
  city: string | null
  animal: string
  status: string
  monthlyAmount: number | null
  currency: string | null
  provider: string
  variableSymbol: string | null
  createdAt: string | null
}

/** Same rows as GET …/adoptions/export.csv (ACTIVE + PENDING subscriptions). */
async function loadSubscriptionExportRows(): Promise<SubscriptionExportRow[]> {
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

  return subs.map((r) => {
    const animalName = r.animal?.jmeno || r.animal?.name || r.animal?.id || ''
    return {
      email: r.user?.email ?? null,
      firstName: r.user?.firstName ?? null,
      lastName: r.user?.lastName ?? null,
      street: r.user?.street ?? null,
      streetNo: r.user?.streetNo ?? null,
      zip: r.user?.zip ?? null,
      city: r.user?.city ?? null,
      animal: animalName,
      status: String(r.status),
      monthlyAmount: r.monthlyAmount,
      currency: r.currency ?? null,
      provider: String(r.provider),
      variableSymbol: r.variableSymbol ?? null,
      createdAt: r.createdAt?.toISOString?.() ? r.createdAt.toISOString() : null,
    }
  })
}

/** Map provider to display method: STRIPE → CARD, FIO → BANK */
function providerToMethod(provider: string | null | undefined): string {
  const p = String(provider ?? '').toUpperCase()
  if (p === 'FIO') return 'BANK'
  return 'CARD' // STRIPE, PAYPAL, etc.
}

// ALL endpoints below require auth + role
router.use(requireAuth, requireAdminOrModerator)

// ───────────────────────────────────────────────────────────────
// REPAIR IMPORT (Admin only, one-time)
// POST /api/admin/stats/repair-import-payments
// Backup + FIO + Stripe import from 2025-12-01 to today
// ───────────────────────────────────────────────────────────────
router.post('/repair-import-payments', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await runRepairImport()
    return res.json(result)
  } catch (e: any) {
    console.error('[repair-import-payments]', e)
    return res.status(500).json({ error: e?.message || 'Repair import failed' })
  }
})

// POST /api/admin/stats/activate-subscription – activate subscription by ID (repair FIO payment mismatch)
router.post('/activate-subscription', requireAdmin, async (req: Request, res: Response) => {
  try {
    const subscriptionId = (req.body?.subscriptionId || req.body?.id || '').toString().trim()
    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId required' })
    }
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, status: true, variableSymbol: true, provider: true },
    })
    if (!sub) {
      return res.status(404).json({ error: 'Subscription not found' })
    }
    if (sub.status === SubscriptionStatus.ACTIVE) {
      return res.json({ ok: true, message: 'Already ACTIVE', subscriptionId })
    }
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE },
    })
    console.log('[activate-subscription]', { subscriptionId, was: sub.status, provider: sub.provider })
    return res.json({ ok: true, message: 'Activated', subscriptionId })
  } catch (e: any) {
    console.error('[activate-subscription]', e)
    return res.status(500).json({ error: e?.message || 'Failed to activate' })
  }
})

// GET /api/admin/stats/share-invites – metrics for donor invite system
router.get('/share-invites', async (_req: Request, res: Response) => {
  try {
    const [totalSent, accepted, pending, declined, expired] = await Promise.all([
      prisma.shareInvite.count(),
      prisma.shareInvite.count({ where: { status: ShareInviteStatus.ACCEPTED } }),
      prisma.shareInvite.count({ where: { status: ShareInviteStatus.PENDING } }),
      prisma.shareInvite.count({ where: { status: ShareInviteStatus.DECLINED } }),
      prisma.shareInvite.count({ where: { status: ShareInviteStatus.EXPIRED } }),
    ])
    const byAnimal = await prisma.shareInvite.groupBy({
      by: ['animalId'],
      _count: { id: true },
      where: { status: ShareInviteStatus.ACCEPTED },
    })
    const animalIds = byAnimal.map((b) => b.animalId)
    const animals = await prisma.animal.findMany({
      where: { id: { in: animalIds } },
      select: { id: true, jmeno: true, name: true },
    })
    const nameById = new Map(animals.map((a) => [a.id, a.jmeno || a.name || a.id]))
    const perAnimal = byAnimal
      .map((b) => ({ animalId: b.animalId, animalName: nameById.get(b.animalId) || b.animalId, accepted: b._count.id }))
      .sort((a, b) => b.accepted - a.accepted)
      .slice(0, 20)

    return res.json({
      ok: true,
      totalSent,
      accepted,
      pending,
      declined,
      expired,
      perAnimal,
    })
  } catch (e: any) {
    console.error('GET /api/admin/stats/share-invites error', e)
    return res.status(500).json({ error: 'internal error' })
  }
})

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
      subsActiveStripe,
      subsActiveFio,
      subsPendingStripe,
      subsPendingFio,
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
          ...statsPaymentWhere,
          paidAt: { gte: startOfThisMonth },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: PS.PAID,
          ...statsPaymentWhere,
          paidAt: { gte: startOfLastMonth, lt: startOfThisMonth },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.PENDING } }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, provider: PaymentProvider.STRIPE },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, provider: PaymentProvider.FIO },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.PENDING, provider: PaymentProvider.STRIPE },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.PENDING, provider: PaymentProvider.FIO },
      }),
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
        subscriptionsActiveStripe: subsActiveStripe,
        subscriptionsActiveFio: subsActiveFio,
        subscriptionsPendingStripe: subsPendingStripe,
        subscriptionsPendingFio: subsPendingFio,
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
    // Payment: filter by paidAt (when money arrived); fallback createdAt for records without paidAt
    const paymentWhere = range
      ? { AND: [statsPaymentWhere, { OR: [{ paidAt: range }, { paidAt: null, createdAt: range }] } as any] }
      : statsPaymentWhere
    const pledgeFilter = range ? { createdAt: range } : {}

    const [subPayments, pledgePayments] = await Promise.all([
      prisma.payment.findMany({
        where: paymentWhere,
        orderBy: { paidAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          providerRef: true,
          createdAt: true,
          paidAt: true,
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
        where: pledgeFilter as any,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          providerId: true,
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
        providerRef: p.providerRef ?? null,
        method: providerToMethod(p.provider),
        createdAt: p.paidAt ?? p.createdAt,
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
        providerRef: pp.providerId ?? null,
        method: providerToMethod(pp.provider),
        createdAt: pp.createdAt,
        userEmail: pp.pledge?.email ?? null,
        animalId: pp.pledge?.animalId ?? null,
        animalName: null,
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

    const total = rows.reduce((s, r) => s + (String(r.status || '').toUpperCase() === 'PAID' ? (r.amount ?? 0) : 0), 0)

    // Count only payments where providerRef starts with "in_" (Stripe invoice)
    const countIn = rows.filter((r) => String((r as any).providerRef ?? '').startsWith('in_')).length

    res.json({ ok: true, count: countIn, total, rows })
  } catch (e: any) {
    console.error('GET /api/admin/stats/payments error', e)
    const msg = e?.message || String(e)
    res.status(500).json({ error: 'internal error', detail: msg })
  }
})

// ───────────────────────────────────────────────────────────────
// 2) PLEDGES (Detaily) – Pledge (PENDING) + Subscription (PENDING, FIO bank)
// GET /api/admin/stats/pledges?from=YYYY-MM-DD&to=YYYY-MM-DD
// ───────────────────────────────────────────────────────────────
router.get('/pledges', async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query)

    // Pending pledges
    const pledgeWhere: any = { status: PS.PENDING }
    if (range) pledgeWhere.createdAt = range

    // PENDING subscriptions (FIO bank transfers waiting for payment)
    const subWhere: any = { status: SubscriptionStatus.PENDING, provider: PaymentProvider.FIO }
    if (range) subWhere.createdAt = range

    const [pledgeRows, pledgeAgg, pendingSubs] = await Promise.all([
      prisma.pledge.findMany({
        where: pledgeWhere,
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
        where: pledgeWhere,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.subscription.findMany({
        where: subWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          monthlyAmount: true,
          variableSymbol: true,
          user: { select: { email: true } },
          animal: { select: { id: true, jmeno: true, name: true } },
        },
      }),
    ])

    const animalIds = [...new Set(pledgeRows.map((p) => p.animalId).filter(Boolean))]
    const animals =
      animalIds.length > 0
        ? await prisma.animal.findMany({
            where: { id: { in: animalIds } },
            select: { id: true, jmeno: true, name: true },
          })
        : []
    const animalMap = new Map(animals.map((a) => [a.id, a.jmeno || a.name || a.id]))

    const pledgeItems = pledgeRows.map((p) => ({
      id: p.id,
      source: 'Karta (čeká platba)',
      createdAt: p.createdAt,
      email: p.email,
      animalId: p.animalId,
      animalName: animalMap.get(p.animalId) ?? p.animalId,
      amount: p.amount,
      status: p.status,
      method: (p.method ?? 'CARD') as string,
      interval: p.interval,
    }))

    const subItems = pendingSubs.map((s) => ({
      id: s.id,
      source: 'Převod (čeká import)',
      createdAt: s.createdAt,
      email: s.user?.email ?? null,
      animalId: s.animal?.id ?? null,
      animalName: s.animal?.jmeno || s.animal?.name || null,
      amount: s.monthlyAmount ?? 0,
      status: 'PENDING',
      method: 'BANK' as const,
      variableSymbol: s.variableSymbol,
    }))

    const rows = [...pledgeItems, ...subItems].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    )

    const pledgeSum = pledgeAgg._sum.amount || 0
    const subSum = pendingSubs.reduce((s, x) => s + (x.monthlyAmount || 0), 0)

    res.json({
      ok: true,
      count: rows.length,
      sum: pledgeSum + subSum,
      rows,
      byStatus: {
        PENDING: {
          count: rows.length,
          sum: pledgeSum + subSum,
        },
      },
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

    // paid subscription payments (stats: only in_ for STRIPE)
    const paidSubPayments = await prisma.payment.findMany({
      where: {
        status: PS.PAID,
        ...statsPaymentWhere,
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
      prisma.payment.aggregate({ where: { status: PS.PAID, ...statsPaymentWhere }, _sum: { amount: true } }),
      prisma.payment.count({ where: { status: PS.PAID, ...statsPaymentWhere } }),
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
// 5b) CSV EXPORT – variable symbols starting with 595 (full data for FIO cross-check)
// GET /api/admin/stats/adoptions/export-vs-595.csv
// ───────────────────────────────────────────────────────────────
router.get('/adoptions/export-vs-595.csv', async (_req: Request, res: Response) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: {
        variableSymbol: { startsWith: '595' },
      },
      include: {
        user: true,
        animal: true,
      },
      orderBy: { variableSymbol: 'asc' },
    })

    const header = [
      'variableSymbol',
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
      'message',
      'createdAt',
      'startedAt',
      'pendingSince',
    ].join(';')

    const lines: string[] = [header]

    for (const r of subs) {
      const animalName = r.animal?.jmeno || r.animal?.name || r.animal?.id || ''
      lines.push(
        [
          csvEscape(r.variableSymbol),
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
          csvEscape(r.message),
          csvEscape(r.createdAt?.toISOString?.() ? r.createdAt.toISOString() : r.createdAt),
          csvEscape(r.startedAt?.toISOString?.() ? r.startedAt.toISOString() : r.startedAt),
          csvEscape(r.pendingSince?.toISOString?.() ? r.pendingSince.toISOString() : r.pendingSince),
        ].join(';')
      )
    }

    const csv = '\uFEFF' + lines.join('\n')
    const today = new Date().toISOString().slice(0, 10)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dogpoint-vs-595-${today}.csv"`
    )

    return res.status(200).send(csv)
  } catch (e: any) {
    console.error('GET /api/admin/stats/adoptions/export-vs-595.csv error', e)
    return res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 6a) JSON — same data as export.csv (searchable UI in admin)
// GET /api/admin/stats/adoptions/export.json
// ───────────────────────────────────────────────────────────────
router.get('/adoptions/export.json', async (_req: Request, res: Response) => {
  try {
    const rows = await loadSubscriptionExportRows()
    return res.json({ ok: true, count: rows.length, rows })
  } catch (e: any) {
    console.error('GET /api/admin/stats/adoptions/export.json error', e)
    return res.status(500).json({ error: 'internal error' })
  }
})

// ───────────────────────────────────────────────────────────────
// 6) CSV EXPORT (frontend expects this exact endpoint)
// GET /api/admin/stats/adoptions/export.csv
// ───────────────────────────────────────────────────────────────
router.get('/adoptions/export.csv', async (_req: Request, res: Response) => {
  try {
    const exportRows = await loadSubscriptionExportRows()

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

    for (const r of exportRows) {
      lines.push(
        [
          csvEscape(r.email),
          csvEscape(r.firstName),
          csvEscape(r.lastName),
          csvEscape(r.street),
          csvEscape(r.streetNo),
          csvEscape(r.zip),
          csvEscape(r.city),
          csvEscape(r.animal),
          csvEscape(r.status),
          csvEscape(r.monthlyAmount),
          csvEscape(r.currency),
          csvEscape(r.provider),
          csvEscape(r.variableSymbol),
          csvEscape(r.createdAt),
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