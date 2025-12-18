// backend/src/routes/adminDashboard.ts
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { PaymentStatus as PS, SubscriptionStatus } from '@prisma/client'

const router = Router()

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u: any = (req as any).user
  if (!u || (u.role !== 'ADMIN' && u.role !== 'MODERATOR')) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

function monthRangeUTC(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const from = new Date(Date.UTC(y, m, 1))
  const to = new Date(Date.UTC(y, m + 1, 1))
  return { from, to }
}

function prevMonthRangeUTC(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))
  return { from, to }
}

// auth for all endpoints here
router.use(requireAuth, requireAdmin)

/**
 * GET /api/admin/dashboard/overview
 * Returns dashboard KPIs (cards) in one response.
 */
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const thisM = monthRangeUTC(now)
    const prevM = prevMonthRangeUTC(now)

    // Payments received this month / last month (Subscription payments only for now)
    // (If you also want pledge payments included, tell me and I’ll add them safely.)
    const [thisMonthAgg, prevMonthAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { createdAt: { gte: thisM.from, lt: thisM.to }, status: PS.PAID },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: prevM.from, lt: prevM.to }, status: PS.PAID },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    // Expected monthly income from ACTIVE subscriptions
    const activeSubs = await prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      select: { monthlyAmount: true, currency: true },
    })
    const expectedMonthlyCzk = activeSubs
      .filter((s) => s.currency === 'CZK')
      .reduce((sum, s) => sum + (s.monthlyAmount || 0), 0)

    // Basic operational counts (only if models exist in your Prisma schema)
    // If any of these models don’t exist, replace them with your actual ones.
    const [
      usersTotal,
      animalsActive,
      animalsPending,
      postsPublished,
      postsPending,
      subsActiveCount,
      subsPendingCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.animal.count({ where: { active: true } }).catch(() => prisma.animal.count()),
      prisma.animal.count({ where: { active: false } }).catch(async () => 0),
      prisma.post.count({ where: { status: 'PUBLISHED' as any } }).catch(async () => 0),
      prisma.post.count({ where: { status: 'PENDING_REVIEW' as any } }).catch(async () => 0),
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.PENDING } as any }).catch(async () => 0),
    ])

    // “Donors (estimate)” = users with at least one ACTIVE subscription
    const donorsEstimate = await prisma.subscription
      .findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        select: { userId: true },
        distinct: ['userId'],
      })
      .then((rows) => rows.length)
      .catch(() => 0)

    res.json({
      ok: true,
      expectedMonthlyCzk,
      receivedThisMonthCzk: Number(thisMonthAgg._sum.amount || 0),
      receivedThisMonthCount: Number(thisMonthAgg._count._all || 0),
      receivedPrevMonthCzk: Number(prevMonthAgg._sum.amount || 0),
      receivedPrevMonthCount: Number(prevMonthAgg._count._all || 0),
      usersTotal,
      donorsEstimate,
      subsActiveCount,
      subsPendingCount,
      animalsActive,
      animalsPending,
      postsPublished,
      postsPending,
    })
  } catch (e: any) {
    console.error('GET /api/admin/dashboard/overview error', e)
    res.status(500).json({ error: 'internal error' })
  }
})

export default router