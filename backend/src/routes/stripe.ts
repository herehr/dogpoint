// backend/src/routes/stripe.ts
import express, { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import jwt, { Secret } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

/* --------------------------- Stripe client --------------------------- */
const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
if (!stripeSecret) {
  console.warn('[stripe] Missing STRIPE_SECRET_KEY / STRIPE_SECRET — checkout will fail until set.')
}
const stripe = new Stripe(stripeSecret || 'sk_test_dummy')

/* ------------------------------ helpers ------------------------------ */
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

/* =============================== RAW ================================ */
/** Webhook must receive the raw body. Mount BEFORE express.json(). */
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
        // Dev fallback: accept unverified (only for non-prod)
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

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        // Mark pledge PAID by metadata/providerId
        const pledgeId = (session.metadata as any)?.pledgeId as string | undefined
        try {
          if (pledgeId) {
            await prisma.pledge.update({
              where: { id: pledgeId },
              data: { status: 'PAID', providerId: session.id },
            })
          } else {
            const p = await prisma.pledge.findFirst({ where: { providerId: session.id } })
            if (p && p.status !== 'PAID') {
              await prisma.pledge.update({ where: { id: p.id }, data: { status: 'PAID' } })
            }
          }
        } catch {/* ignore */}

        // Ensure user, link pledges → subscription/payment
        const email = session.customer_email || undefined
        if (email) {
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } })
          await linkPaidOrRecentPledgesToUser(user.id, email)
        }
      }

      res.json({ received: true })
    } catch (e) {
      console.error('[stripe webhook] error:', e)
      res.status(500).send('Webhook handler error')
    }
  }
)

/* =============================== JSON =============================== */
/** Normal JSON endpoints. Mount AFTER express.json(). */
const jsonRouter = Router()
jsonRouter.use(express.json())

// 🔔 Health/ping for Stripe routes
jsonRouter.get('/ping', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    stripeKey: !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET),
    frontendBase: frontendBase(),
  })
})

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
    if (!animalId || typeof animalId !== 'string') return res.status(400).json({ error: 'Missing/invalid animalId' })
    if (!amountCZK || typeof amountCZK !== 'number' || amountCZK <= 0) {
      return res.status(400).json({ error: 'Missing/invalid amountCZK' })
    }

    // Create PENDING pledge (schema-tolerant)
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

    const successUrl = `${frontendBase()}/zvirata/${encodeURIComponent(
      animalId
    )}?paid=1&sid={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${frontendBase()}/zvirata/${encodeURIComponent(animalId)}?canceled=1`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'cs',
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency: 'czk',
      customer_email: email || undefined,
      metadata: { animalId, pledgeId: pledge.id },
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

    await prisma.pledge.update({
      where: { id: pledge.id },
      data: { providerId: session.id },
    })

    res.json({ url: session.url })
  } catch (e) {
    console.error('[stripe checkout-session] error:', e)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

/** GET /api/stripe/confirm?sid=cs_... — fast confirm on success redirect */
jsonRouter.get('/confirm', async (req: Request, res: Response) => {
  try {
    const sid = String(req.query.sid || '')
    if (!sid) return res.status(400).json({ error: 'Missing sid' })

    const session = await stripe.checkout.sessions.retrieve(sid, { expand: ['payment_intent', 'customer'] })
    if (!session || session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'Session not paid yet' })
    }

    const email =
      session.customer_email ||
      ((session.customer as any)?.email as string | undefined) ||
      undefined

    // Mark pledge as PAID
    const pledgeId = (session.metadata || {} as any).pledgeId as string | undefined
    try {
      if (pledgeId) {
        await prisma.pledge.update({ where: { id: pledgeId }, data: { status: 'PAID', providerId: session.id } })
      } else {
        const p = await prisma.pledge.findFirst({ where: { providerId: sid } })
        if (p && p.status !== 'PAID') await prisma.pledge.update({ where: { id: p.id }, data: { status: 'PAID' } })
      }
    } catch {/* ignore */}

    // Ensure user + link pledges; return token if possible
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