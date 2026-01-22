import { Router } from 'express'
import { prisma } from '../prisma'
import { checkRole } from '../middleware/checkRole'
import { Role } from '@prisma/client'

const router = Router()

/**
 * GET /api/admin/stats/animals
 * Returns:
 * - donorsActive: number of ACTIVE subscriptions per animal (unique donors)
 * - monthlyActiveSum: sum of monthlyAmount for ACTIVE subscriptions
 * - paidSumSubscriptions: sum of PAID Payment.amount linked via Subscription
 * - paidSumPledges: sum of PAID PledgePayment.amount linked via Pledge
 * - paidSumTotal: paidSumSubscriptions + paidSumPledges
 */
router.get('/animals', checkRole(Role.ADMIN), async (_req, res) => {
  // Postgres SQL is the fastest + simplest here (avoids N+1 and distinct pitfalls)
  const rows = await prisma.$queryRaw<
    Array<{
      animalId: string
      animalName: string | null
      donorsActive: number
      monthlyActiveSum: number
      paidSumSubscriptions: number
      paidSumPledges: number
      paidSumTotal: number
    }>
  >`
    WITH sub_stats AS (
      SELECT
        a.id AS "animalId",
        COALESCE(a."jmeno", a."name") AS "animalName",
        COUNT(DISTINCT s."userId") FILTER (WHERE s."status" = 'ACTIVE')::int AS "donorsActive",
        COALESCE(SUM(s."monthlyAmount") FILTER (WHERE s."status" = 'ACTIVE'), 0)::int AS "monthlyActiveSum",
        COALESCE(SUM(p."amount") FILTER (WHERE p."status" = 'PAID'), 0)::int AS "paidSumSubscriptions"
      FROM "Animal" a
      LEFT JOIN "Subscription" s ON s."animalId" = a.id
      LEFT JOIN "Payment" p ON p."subscriptionId" = s.id
      WHERE a."active" = true
      GROUP BY a.id, COALESCE(a."jmeno", a."name")
    ),
    pledge_stats AS (
      SELECT
        a.id AS "animalId",
        COALESCE(SUM(pp."amount") FILTER (WHERE pp."status" = 'PAID'), 0)::int AS "paidSumPledges"
      FROM "Animal" a
      LEFT JOIN "Pledge" pl ON pl."animalId" = a.id
      LEFT JOIN "PledgePayment" pp ON pp."pledgeId" = pl.id
      WHERE a."active" = true
      GROUP BY a.id
    )
    SELECT
      s."animalId",
      s."animalName",
      s."donorsActive",
      s."monthlyActiveSum",
      s."paidSumSubscriptions",
      COALESCE(p."paidSumPledges", 0)::int AS "paidSumPledges",
      (s."paidSumSubscriptions" + COALESCE(p."paidSumPledges", 0))::int AS "paidSumTotal"
    FROM sub_stats s
    LEFT JOIN pledge_stats p ON p."animalId" = s."animalId"
    ORDER BY "paidSumTotal" DESC, "donorsActive" DESC;
  `

  res.json(rows)
})

export default router