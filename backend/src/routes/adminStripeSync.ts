// backend/src/routes/adminStripeSync.ts
// POST /api/admin/stripe-sync-payments — fetch paid Stripe invoices and create missing Payment rows
import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma'
import { PaymentStatus } from '@prisma/client'
import { requireAuth, requireAdmin } from '../middleware/authJwt'

const router = Router()

/** Browsers open URLs with GET — explain POST + admin auth instead of a bare 401. */
router.get('/stripe-sync-payments', (_req: Request, res: Response) => {
  res.setHeader('Allow', 'POST')
  return res.status(405).json({
    error: 'Method not allowed — use POST',
    auth: 'Authorization: Bearer <JWT> with role ADMIN',
    hint: 'In the app: Admin → Statistiky → „Stripe sync – stáhnout platby“. Or: curl -X POST -H "Authorization: Bearer …" this URL.',
  })
})

router.use(requireAuth, requireAdmin)

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  if (!key) return null
  return new Stripe(key)
}

/**
 * POST /api/admin/stripe-sync-payments
 * Fetches all paid invoices from Stripe and creates Payment rows for any that are not yet stored.
 * Two passes: 1) per our subscriptions (resolves cs_→sub_), 2) list ALL paid invoices (catch-all).
 * Idempotent.
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

    // Map stripeSubId -> our subscription id (for catch-all pass)
    const stripeSubToOurSub = new Map<string, string>()

    let created = 0
    let skipped = 0
    let skippedNoSub = 0
    let skippedNoSubscription = 0
    let subsCreated = 0
    const errors: string[] = []

    // Pass 1: per our subscriptions (resolve cs_→sub_, fetch invoices)
    for (const sub of subs) {
      let stripeSubId: string | null = sub.providerRef
      if (!stripeSubId) continue

      if (stripeSubId.startsWith('cs_')) {
        try {
          const session = await stripe.checkout.sessions.retrieve(stripeSubId, { expand: ['subscription'] })
          const raw = (session as any).subscription
          const resolved = typeof raw === 'string' ? raw : raw?.id ?? null
          if (resolved) {
            await prisma.$executeRaw`UPDATE "Subscription" SET "providerRef" = ${resolved} WHERE id = ${sub.id}`
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

      stripeSubToOurSub.set(stripeSubId, sub.id)

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

    // Pass 2: list ALL paid invoices from Stripe (catch invoices we might have missed)
    let hasMore = true
    let startingAfter: string | undefined
    let invoicesFetched = 0

    while (hasMore) {
      const list = await stripe.invoices.list({
        status: 'paid',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })

      invoicesFetched += list.data.length

      for (const inv of list.data) {
        let rawSub = (inv as any).subscription
        if (!rawSub) {
          const parent = (inv as any).parent
          rawSub = parent?.subscription_details?.subscription
        }
        const stripeSubId = typeof rawSub === 'string' ? rawSub : rawSub?.id
        if (!stripeSubId || !stripeSubId.startsWith('sub_')) {
          skippedNoSubscription++
          continue
        }

        let ourSubId = stripeSubToOurSub.get(stripeSubId)
        if (!ourSubId) {
          let sub = await prisma.subscription.findFirst({
            where: { provider: 'STRIPE' as any, providerRef: stripeSubId },
            select: { id: true },
          })
          if (!sub) {
            // Create missing Subscription from Stripe (animalId from checkout session metadata)
            try {
              const stripeSub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ['customer'] })
              const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id
              const customer = customerId ? await stripe.customers.retrieve(customerId) : null
              const email = (customer as any)?.email?.trim()?.toLowerCase()
              let animalId = (stripeSub.metadata as Record<string, string> | null)?.animalId
              if (!animalId) {
                const sessions = await stripe.checkout.sessions.list({ subscription: stripeSubId, limit: 1 })
                animalId = (sessions.data[0]?.metadata as Record<string, string> | null)?.animalId
              }
              if (!animalId) {
                animalId = (inv.metadata as Record<string, string> | null)?.animalId
              }
              if (!animalId) {
                const subInvoices = await stripe.invoices.list({
                  subscription: stripeSubId,
                  status: 'paid',
                  limit: 100,
                })
                const oldest = subInvoices.data.sort(
                  (a, b) => (a.created || 0) - (b.created || 0)
                )[0]
                animalId = oldest ? ((oldest.metadata as Record<string, string> | null)?.animalId || undefined) : undefined
              }
              if (email && animalId) {
                const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { id: true } })
                if (!animal) continue
                let user = await prisma.user.findUnique({ where: { email } })
                if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } as any })
                sub = await prisma.subscription.findFirst({
                  where: { userId: user.id, animalId, provider: 'STRIPE' },
                  select: { id: true },
                })
                if (!sub) {
                  const amountCZK = inv.amount_paid != null ? Math.round(Number(inv.amount_paid) / 100) : 100
                  const paidAt =
                    (inv as any).status_transitions?.paid_at != null
                      ? new Date(Number((inv as any).status_transitions.paid_at) * 1000)
                      : new Date()
                  sub = await prisma.subscription.create({
                    data: {
                      userId: user.id,
                      animalId,
                      monthlyAmount: amountCZK,
                      currency: 'CZK',
                      provider: 'STRIPE',
                      providerRef: stripeSubId,
                      status: 'ACTIVE',
                      startedAt: paidAt,
                    } as any,
                    select: { id: true },
                  })
                  subsCreated++
                }
              }
            } catch (e) {
              /* skip */
            }
          }
          if (sub) {
            stripeSubToOurSub.set(stripeSubId, sub.id)
            ourSubId = sub.id
          }
        }

        const subId = ourSubId
        if (!subId) {
          skippedNoSub++
          continue
        }

        const providerRef = inv.id
        const existing = await prisma.payment.findFirst({
          where: { subscriptionId: subId, providerRef },
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
              subscriptionId: subId,
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

    const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
    const stripeMode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : key ? 'unknown' : 'missing'
    return res.json({
      ok: true,
      created,
      skipped,
      skippedNoSub,
      skippedNoSubscription,
      subscriptionsChecked: subs.length,
      ...(subsCreated > 0 ? { subscriptionsCreated: subsCreated } : {}),
      invoicesFetched,
      stripeMode,
      errors: errors.length ? errors : undefined,
    })
  } catch (e: any) {
    console.error('[admin stripe-sync-payments]', e)
    return res.status(500).json({ error: e?.message || 'Sync failed' })
  }
})

export default router
