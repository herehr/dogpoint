// backend/src/routes/stripe.ts
import { Router, Request, Response } from 'express'
import express from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma'
import { linkPaidPledgesToUser } from '../controllers/authExtra'

const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
if (!stripeSecret) {
  console.warn('[stripe] Missing STRIPE_SECRET_KEY in environment.')
}

// Let the SDK use its bundled API version (recommended)
// If you want to pin, use a real date string like '2024-06-20'
const stripe = new Stripe(stripeSecret || 'sk_test_dummy')

// -------- Raw router (webhooks need raw body) --------
export const rawRouter = Router()

rawRouter.post(
  '/webhook',
  // IMPORTANT: raw body for Stripe signature verification
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const sig = req.headers['stripe-signature'] as string | undefined
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

      let event: Stripe.Event

      if (!webhookSecret || !sig) {
        console.warn('[stripe] STRIPE_WEBHOOK_SECRET or signature missing; accepting event unverified (dev only).')
        // Best-effort parse for dev
        event = JSON.parse(req.body.toString() || '{}') as Stripe.Event
      } else {
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
        } catch (err: any) {
          console.error('[stripe webhook] signature verification failed:', err?.message)
          res.status(400).send(`Webhook Error: ${err?.message}`)
          return
        }
      }

      // Record the event for audit
      try {
        await prisma.webhookEvent.create({
          data: { provider: 'STRIPE', rawPayload: event as any, processed: false },
        })
      } catch (e) {
        // non-fatal
        console.warn('[stripe webhook] failed to persist webhookEvent:', (e as any)?.message)
      }

      // --- Business logic: convert pledge -> paid & link to user ---
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        // 1) find pledge (prefer metadata.pledgeId; fallback by providerId === session.id)
        const pledgeId = (session.metadata && (session.metadata as any).pledgeId) || null
        let pledge = null

        if (pledgeId) {
          pledge = await prisma.pledge.update({
            where: { id: pledgeId },
            data: { status: 'PAID', providerId: session.id },
          })
        } else {
          pledge = await prisma.pledge.findFirst({ where: { providerId: session.id } })
          if (pledge && pledge.status !== 'PAID') {
            pledge = await prisma.pledge.update({
              where: { id: pledge.id },
              data: { status: 'PAID' },
            })
          }
        }

        // 2) ensure a user exists for the email and link pledges -> subscriptions
        const email = session.customer_email || pledge?.email || null
        if (email) {
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } })
          await linkPaidPledgesToUser(user.id, email)
        }
      }

      // Mark webhookEvent as processed (best-effort)
      try {
        await prisma.webhookEvent.updateMany({
          data: { processed: true },
          where: { processed: false }, // naive, but fine for now
        })
      } catch {
        /* ignore */
      }

      res.json({ received: true })
    } catch (e: any) {
      console.error('[stripe webhook] handler error:', e)
      res.status(500).send('Webhook handler error')
    }
  }
)

// -------- JSON router (normal JSON endpoints) --------
const jsonRouter = Router()
jsonRouter.use(express.json())

/**
 * POST /api/stripe/checkout-session
 * body: { animalId: string, amountCZK: number, email?: string, name?: string }
 */
jsonRouter.post('/checkout-session', async (req: Request, res: Response) => {
  try {
    const { animalId, amountCZK, email, name } = (req.body || {}) as {
      animalId?: string
      amountCZK?: number
      email?: string
      name?: string
    }

    if (!animalId || typeof animalId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid animalId' })
      return
    }
    if (!amountCZK || typeof amountCZK !== 'number' || amountCZK <= 0) {
      res.status(400).json({ error: 'Missing or invalid amountCZK' })
      return
    }

    // Create a lightweight pledge row (pending) so we can reconcile later
    const pledge = await prisma.pledge.create({
      data: {
        animalId,
        email: email ?? 'unknown@example.com',
        name: name ?? null,
        amount: amountCZK,
        interval: 'MONTHLY',
        method: 'CARD',
        status: 'PENDING',
      },
    })

    // Build success / cancel URLs
    const FRONTEND_BASE =
      process.env.PUBLIC_WEB_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      'https://example.com'

    const successUrl = `${FRONTEND_BASE}/zvirata/${encodeURIComponent(animalId)}?paid=1`
    const cancelUrl  = `${FRONTEND_BASE}/zvirata/${encodeURIComponent(animalId)}?canceled=1`

    // Create Stripe Checkout Session (CZK only)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'cs',
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency: 'czk',
      customer_email: email || undefined,
      metadata: {
        animalId,
        pledgeId: pledge.id,
      },
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: {
              name: name ? `Adopce: ${name}` : 'Adopce zvířete',
              description: `Měsíční dar pro zvíře (${animalId})`,
            },
            unit_amount: Math.round(amountCZK * 100),
          },
          quantity: 1,
        },
      ],
    })

    // Store session id on pledge so webhook can reconcile
    await prisma.pledge.update({
      where: { id: pledge.id },
      data: { providerId: session.id },
    })

    res.json({ url: session.url })
  } catch (e: any) {
    console.error('[stripe checkout-session] error:', e)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

export default jsonRouter