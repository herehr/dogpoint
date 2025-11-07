// backend/src/routes/stripe.ts
import express, { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

/** ---------- Stripe client ---------- */
const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
if (!stripeSecret) {
  console.warn('[stripe] Missing STRIPE_SECRET_KEY in environment.')
}
// Use the SDK’s bundled API version (recommended). Pin only if you must.
const stripe = new Stripe(stripeSecret || 'sk_test_dummy')

/** ---------- helpers ---------- */
function signToken(user: { id: string; role: string; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, rawSecret, { expiresIn: '7d' })
}

/** =========================================================================
 *  RAW router (webhook needs raw body)
 *  ========================================================================= */
export const rawRouter = Router()

rawRouter.post(
  '/webhook',
  // IMPORTANT: keep raw body here (no JSON parser before this route)
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const sig = req.headers['stripe-signature'] as string | undefined
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

      let event: Stripe.Event
      if (!webhookSecret || !sig) {
        console.warn('[stripe] STRIPE_WEBHOOK_SECRET or signature missing; accepting event unverified (dev only).')
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

      // Store for audit (best-effort)
      try {
        await prisma.webhookEvent.create({
          data: { provider: 'STRIPE', rawPayload: event as any, processed: false },
        })
      } catch (e) {
        console.warn('[stripe webhook] failed to persist webhookEvent:', (e as any)?.message)
      }

      // Business logic on successful checkout
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        // 1) Resolve pledge and mark as PAID
        const pledgeId = (session.metadata && (session.metadata as any).pledgeId) || null
        let pledge = null as Awaited<ReturnType<typeof prisma.pledge.findFirst>> | null

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

        // 2) Ensure a user and link pledges → subscription/payment
        const email = session.customer_email || pledge?.email || null
        if (email) {
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } })
          await linkPaidOrRecentPledgesToUser(user.id, email)
        }
      }

      // Mark webhookEvent as processed (best-effort)
      try {
        await prisma.webhookEvent.updateMany({ data: { processed: true }, where: { processed: false } })
      } catch {/* ignore */}

      res.json({ received: true })
    } catch (e: any) {
      console.error('[stripe webhook] handler error:', e)
      res.status(500).send('Webhook handler error')
    }
  }
)

/** =========================================================================
 *  JSON router (normal JSON endpoints)
 *  ========================================================================= */
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

    // Create a lightweight pledge (PENDING)
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

    // Success/cancel URLs (include session id in success to allow instant confirm)
    const FRONTEND_BASE =
      process.env.PUBLIC_WEB_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      'https://example.com'

    const successUrl = `${FRONTEND_BASE}/zvirata/${encodeURIComponent(animalId)}?paid=1&sid={CHECKOUT_SESSION_ID}`
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

    // Store session id on pledge so webhook/confirm can reconcile
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

/**
 * GET /api/stripe/confirm?sid=cs_...
 * Used by the frontend on success redirect to unblur content immediately
 * (no need to wait for webhook delivery).
 * Returns { ok: true, token?: string }
 */
jsonRouter.get('/confirm', async (req: Request, res: Response) => {
  try {
    const sid = String(req.query.sid || '')
    if (!sid) {
      res.status(400).json({ error: 'Missing sid' })
      return
    }

    // 1) Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sid, {
      expand: ['payment_intent', 'customer'],
    })

    if (!session || session.payment_status !== 'paid') {
      res.status(409).json({ error: 'Session not paid yet' })
      return
    }

    const email =
      session.customer_email ||
      ((session.customer as any)?.email as string | undefined) ||
      undefined
    const meta = (session.metadata || {}) as Record<string, string | undefined>
    const animalId = meta.animalId
    const pledgeId = meta.pledgeId

    // 2) Mark pledge as PAID
    let pledge = null as Awaited<ReturnType<typeof prisma.pledge.findFirst>> | null
    if (pledgeId) {
      pledge = await prisma.pledge.update({
        where: { id: pledgeId },
        data: { status: 'PAID', providerId: session.id },
      })
    } else {
      pledge = await prisma.pledge.findFirst({ where: { providerId: sid } })
      if (pledge && pledge.status !== 'PAID') {
        pledge = await prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: 'PAID' },
        })
      }
    }

    // 3) Ensure user and link pledges
    let token: string | null = null
    if (email) {
      let user = await prisma.user.findUnique({ where: { email } })
      if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } })
      await linkPaidOrRecentPledgesToUser(user.id, email)
      token = signToken({ id: user.id, role: user.role, email: user.email })
    } else if (pledge?.email) {
      let user = await prisma.user.findUnique({ where: { email: pledge.email } })
      if (!user) user = await prisma.user.create({ data: { email: pledge.email, role: 'USER' } })
      await linkPaidOrRecentPledgesToUser(user.id, user.email)
      token = signToken({ id: user.id, role: user.role, email: user.email })
    }

    res.json({ ok: true, token })
  } catch (e: any) {
    console.error('[stripe confirm] error:', e)
    res.status(500).json({ error: 'Failed to confirm session' })
  }
})

export default jsonRouter