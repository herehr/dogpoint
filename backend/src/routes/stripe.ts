// backend/src/routes/stripe.ts
import express, { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import jwt, { Secret } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

/* ------------------------------------------------------------------ */
/* Stripe client                                                      */
/* ------------------------------------------------------------------ */
const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
if (!stripeSecret) {
  console.warn('[stripe] Missing STRIPE_SECRET_KEY. Checkout will fail until set.')
}
const stripe = new Stripe(stripeSecret || 'sk_test_dummy')

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function signToken(user: { id: string; role: string; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, rawSecret as Secret, { expiresIn: '7d' })
}

function frontendBase(): string {
  return (
    process.env.PUBLIC_WEB_BASE_URL ||
    process.env.FRONTEND_BASE_URL ||
    'https://example.com'
  ).replace(/\/+$/, '')
}

/* =========================================================================
 * RAW router (webhook needs raw body; mount BEFORE express.json())
 * ========================================================================= */
export const rawRouter = Router()

rawRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const sig = req.headers['stripe-signature'] as string | undefined
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

      let event: Stripe.Event
      if (!webhookSecret || !sig) {
        // Dev/preview fallback (unverified)
        try {
          event = JSON.parse(req.body.toString() || '{}') as Stripe.Event
        } catch {
          res.status(400).send('Invalid webhook payload')
          return
        }
      } else {
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
        } catch (err: any) {
          console.error('[stripe webhook] signature verification failed:', err?.message)
          res.status(400).send(`Webhook Error: ${err?.message}`)
          return
        }
      }

      // best-effort: persist raw event if you have such a table
      try {
        // optional table; wrap in try/catch so schema mismatches don’t break you
        // @ts-ignore - optional model
        await prisma.webhookEvent?.create?.({
          data: { provider: 'STRIPE', rawPayload: event as any, processed: false },
        })
      } catch { /* ignore if model not present */ }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        // 1) Find or update related pledge to PAID
        const pledgeId = (session.metadata as any)?.pledgeId as string | undefined
        let pledge = null as any

        if (pledgeId) {
          try {
            pledge = await prisma.pledge.update({
              where: { id: pledgeId },
              data: { status: 'PAID', providerId: session.id },
            })
          } catch { /* ignore if already PAID or schema differs */ }
        } else {
          pledge = await prisma.pledge.findFirst({ where: { providerId: session.id } })
          if (pledge && pledge.status !== 'PAID') {
            try {
              pledge = await prisma.pledge.update({
                where: { id: pledge.id },
                data: { status: 'PAID' },
              })
            } catch { /* ignore */ }
          }
        }

        // 2) Ensure a user and link pledges → subscriptions/payments
        const email = session.customer_email || pledge?.email || null
        if (email) {
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } })
          await linkPaidOrRecentPledgesToUser(user.id, email)
        }
      }

      // mark processed if you keep a log table
      try {
        // @ts-ignore - optional model
        await prisma.webhookEvent?.updateMany?.({ data: { processed: true }, where: { processed: false } })
      } catch { /* ignore */ }

      res.json({ received: true })
    } catch (e) {
      console.error('[stripe webhook] handler error:', e)
      res.status(500).send('Webhook handler error')
    }
  }
)

/* =========================================================================
 * JSON router (normal JSON endpoints; mount AFTER express.json())
 * ========================================================================= */
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

    // Create a lightweight pledge (PENDING); keep fields schema-tolerant
    const pledge = await prisma.pledge.create({
      data: {
        animalId,
        email: email ?? null,
        name: name ?? null,
        amount: amountCZK,
        interval: 'MONTHLY' as any,
        method: 'CARD' as any,
        status: 'PENDING' as any,
      } as any,
    })

    const FRONTEND_BASE = frontendBase()
    const successUrl = `${FRONTEND_BASE}/zvirata/${encodeURIComponent(animalId)}?paid=1&sid={CHECKOUT_SESSION_ID}`
    const cancelUrl  = `${FRONTEND_BASE}/zvirata/${encodeURIComponent(animalId)}?canceled=1`

    // Create Checkout Session (CZK)
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

    // Store Stripe session id on pledge
    try {
      await prisma.pledge.update({
        where: { id: pledge.id },
        data: { providerId: session.id },
      })
    } catch { /* ignore */ }

    res.json({ url: session.url })
  } catch (e) {
    console.error('[stripe checkout-session] error:', e)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

/**
 * GET /api/stripe/confirm?sid=cs_...
 * For instant confirmation at success redirect.
 * Returns { ok: true, token?: string }
 */
jsonRouter.get('/confirm', async (req: Request, res: Response) => {
  try {
    const sid = String(req.query.sid || '')
    if (!sid) {
      res.status(400).json({ error: 'Missing sid' })
      return
    }


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
    const pledgeId = meta.pledgeId

    // Mark pledge as PAID
    try {
      if (pledgeId) {
        await prisma.pledge.update({
          where: { id: pledgeId },
          data: { status: 'PAID', providerId: session.id },
        })
      } else {
        const p = await prisma.pledge.findFirst({ where: { providerId: sid } })
        if (p && p.status !== 'PAID') {
          await prisma.pledge.update({ where: { id: p.id }, data: { status: 'PAID' } })
        }
      }
    } catch { /* ignore */ }

    // Ensure user + link pledges; return token if we can
    let token: string | null = null
    const resolvedEmail =
      email ||
      (await (async () => {
        const p = await prisma.pledge.findFirst({ where: { providerId: sid } })
        return p?.email || undefined
      })())

    if (resolvedEmail) {
      let user = await prisma.user.findUnique({ where: { email: resolvedEmail } })
      if (!user) user = await prisma.user.create({ data: { email: resolvedEmail, role: 'USER' } })
      await linkPaidOrRecentPledgesToUser(user.id, resolvedEmail)
      token = signToken({ id: user.id, role: user.role, email: user.email })
    }

    res.json({ ok: true, token })
  } catch (e) {
    console.error('[stripe confirm] error:', e)
    res.status(500).json({ error: 'Failed to confirm session' })
  }
})

export default jsonRouter