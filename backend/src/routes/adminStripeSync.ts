// backend/src/routes/adminStripeSync.ts
// POST /api/admin/stripe-sync-payments — fetch paid Stripe invoices and create missing Payment rows
import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma'
import { PaymentStatus } from '@prisma/client'
import { requireAuth, requireAdmin } from '../middleware/authJwt'

const router = Router()
router.use(requireAuth, requireAdmin)

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  if (!key) return null
  return new Stripe(key)
}

/**
 * POST /api/admin/stripe-sync-payments
 * Fetches all paid invoices from Stripe for subscriptions we have in DB (provider=STRIPE, providerRef=sub_xxx)
 * and creates Payment rows for any that are not yet stored. Idempotent.
 */
router.post('/stripe-sync-payments', async (_req: Request, res: Response) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured (STRIPE_SECRET_KEY)' })
    }

    const subs = await prisma.subscription.findMany({
      where: { provider: 'STRIPE', providerRef: { not: null } },
      select: { id: true, providerRef: true },
    })

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const sub of subs) {
      let stripeSubId: string | null = sub.providerRef
      if (!stripeSubId) continue

      // If we stored checkout session id (cs_xxx), resolve to Stripe subscription id and update DB
      if (stripeSubId.startsWith('cs_')) {
        try {
          const session = await stripe.checkout.sessions.retrieve(stripeSubId, { expand: ['subscription'] })
          const raw = (session as any).subscription
          const resolved = typeof raw === 'string' ? raw : raw?.id ?? null
          if (resolved) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { providerRef: resolved } as any,
            })
            stripeSubId = resolved
          } else {
            stripeSubId = null
          }
        } catch (e: any) {
          errors.push(`Session ${stripeSubId}: ${e?.message || String(e)}`)
          continue
        }
      }
      if (!stripeSubId || !stripeSubId.startsWith('sub_')) continue

      let hasMore = true
      let startingAfter: string | undefined

      while (hasMore) {
        const list = await stripe.invoices.list({
          subscription: stripeSubId,
          status: 'paid',
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        })

        for (const inv of list.data) {
          const providerRef = inv.id
          const existing = await prisma.payment.findFirst({
            where: { subscriptionId: sub.id, providerRef },
            select: { id: true },
          })
          if (existing) {
            skipped++
            continue
          }

          const amountCZK = inv.amount_paid != null ? Math.round(Number(inv.amount_paid) / 100) : 0
          const paidAt =
            (inv as any).status_transitions?.paid_at != null
              ? new Date(Number((inv as any).status_transitions.paid_at) * 1000)
              : new Date()

          try {
            await prisma.payment.create({
              data: {
                subscriptionId: sub.id,
                provider: 'STRIPE',
                providerRef,
                amount: amountCZK || 1,
                currency: (inv.currency || 'czk').toUpperCase(),
                status: PaymentStatus.PAID,
                paidAt,
              } as any,
            })
            created++
          } catch (e: any) {
            if (e?.code === 'P2002') skipped++
            else errors.push(`${inv.id}: ${e?.message || String(e)}`)
          }
        }

        hasMore = list.has_more
        if (list.data.length > 0) startingAfter = list.data[list.data.length - 1].id
        else hasMore = false
      }
    }

    return res.json({
      ok: true,
      created,
      skipped,
      subscriptionsChecked: subs.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (e: any) {
    console.error('[admin stripe-sync-payments]', e)
    return res.status(500).json({ error: e?.message || 'Sync failed' })
  }
})

export default router
