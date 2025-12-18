// backend/src/routes/adminStats.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { Role, PaymentStatus, ContentStatus } from '@prisma/client'

const router = Router()

function isAdmin(req: Request): boolean {
  const r = (req.user as any)?.role
  return r === Role.ADMIN || r === 'ADMIN'
}

/**
 * GET /api/admin/stats
 * ADMIN only
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' })

  try {
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      usersTotal,
      usersDonors, // users with at least one Subscription or Pledge
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
          OR: [
            { subscriptions: { some: {} } },
            // If you later link pledges to a user, replace this.
            // For now, donor proxy is subscription presence.
          ],
        },
      }),
      prisma.animal.count({ where: { active: true, status: ContentStatus.PUBLISHED } }),
      prisma.animal.count({ where: { active: true, status: ContentStatus.PENDING_REVIEW } }),
      prisma.post.count({ where: { active: true, status: ContentStatus.PUBLISHED } }),
      prisma.post.count({ where: { active: true, status: ContentStatus.PENDING_REVIEW } }),
      prisma.pledge.count({ where: { status: PaymentStatus.PENDING } }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfThisMonth },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfLastMonth, lt: startOfThisMonth },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' as any } }),
      prisma.subscription.count({ where: { status: 'PENDING' as any } }),
    ])

    // Expected monthly income = sum of active monthly subscriptions
    const expectedMonthly = await prisma.subscription.aggregate({
      where: { status: 'ACTIVE' as any },
      _sum: { monthlyAmount: true },
    })

    res.json({
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

export default router