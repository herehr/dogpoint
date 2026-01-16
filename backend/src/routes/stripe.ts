// backend/src/routes/stripe.ts
import express, { Router, type Request, type Response } from 'express'
import Stripe from 'stripe'
import jwt, { Secret } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

// ✅ Adoption notifications + e-mail
import { notifyAdoptionStarted } from '../services/notifyAdoptionStarted'
import { sendEmail } from '../services/email'

/* ------------------------------------------------------------------ */
/* Stripe client                                                      */
/* ------------------------------------------------------------------ */
const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
if (!stripeSecret) console.warn('[stripe] Missing STRIPE_SECRET_KEY. Checkout will fail until set.')
const stripe = stripeSecret ? new Stripe(stripeSecret) : null

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
type JwtPayloadLite = {
  sub?: string
  role?: string
  email?: string
}

function mustJwtSecret(): string {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  return rawSecret
}

function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, mustJwtSecret() as Secret, { expiresIn: '7d' })
}

function frontendBase(): string {
  return (process.env.PUBLIC_WEB_BASE_URL || process.env.FRONTEND_BASE_URL || 'https://example.com').replace(/\/+$/, '')
}

function normalizeEmail(x?: string | null): string | undefined {
  const s = (x ?? '').trim().toLowerCase()
  return s ? s : undefined
}

function getOptionalJwt(req: Request): JwtPayloadLite | null {
  try {
    const rawSecret = process.env.JWT_SECRET
    if (!rawSecret) return null

    const h = String(req.headers.authorization || '')
    if (!h.toLowerCase().startsWith('bearer ')) return null

    const token = h.slice('bearer '.length).trim()
    if (!token) return null

    return (jwt.verify(token, rawSecret as Secret) as JwtPayloadLite) || null
  } catch {
    return null
  }
}

async function getOrCreateCustomerId(email: string): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured')

  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id

  const created = await stripe.customers.create({ email })
  return created.id
}

/**
 * ✅ When Stripe is paid, ensure a DB Subscription exists + is ACTIVE.
 * IMPORTANT: your Prisma model requires monthlyAmount + provider.
 */
async function ensureDbSubscriptionActive(opts: {
  userId: string
  animalId: string
  monthlyAmountCZK: number
  startedAt?: Date
  providerRef?: string | null
}) {
  const { userId, animalId } = opts
  const startedAt = opts.startedAt ?? new Date()

  const monthlyAmount = Math.round(Number(opts.monthlyAmountCZK))
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new Error('[ensureDbSubscriptionActive] monthlyAmountCZK invalid/missing')
  }

  // Find existing subscription for this user+animal (latest)
  const existing = await prisma.subscription.findFirst({
    where: { userId, animalId } as any,
    orderBy: { createdAt: 'desc' } as any,
  })

  // Helper: send notification once (best-effort)
  async function notifyOnce() {
    try {
      await notifyAdoptionStarted(userId, animalId, { sendEmail: true, sendEmailFn: sendEmail })
    } catch (e) {
      console.warn('[notifyAdoptionStarted] failed', e)
    }
  }

  if (!existing) {
    await prisma.subscription.create({
      data: {
        userId,
        animalId,
        monthlyAmount,
        currency: 'CZK',
        provider: 'STRIPE' as any,
        providerRef: opts.providerRef ?? null,
        status: 'ACTIVE' as any,
        startedAt,
      } as any,
    })

    await notifyOnce()
    return
  }

  // If exists but canceled, do NOT revive automatically
  if (String((existing as any).status || '').toUpperCase() === 'CANCELED') {
    return
  }

  // If not ACTIVE, activate it (and set monthlyAmount/provider if missing)
  if (String((existing as any).status || '').toUpperCase() !== 'ACTIVE') {
    await prisma.subscription.update({
      where: { id: (existing as any).id },
      data: {
        status: 'ACTIVE' as any,
        startedAt: (existing as any).startedAt ?? startedAt,
        monthlyAmount: (existing as any).monthlyAmount ?? monthlyAmount,
        currency: (existing as any).currency ?? 'CZK',
        provider: (existing as any).provider ?? ('STRIPE' as any),
        providerRef: (existing as any).providerRef ?? (opts.providerRef ?? null),
      } as any,
    })

    await notifyOnce()
    return
  }

  // Already ACTIVE: just ensure monthlyAmount/providerRef are set (no notification)
  const needsPatch =
    !(existing as any).monthlyAmount ||
    !(existing as any).provider ||
    ((existing as any).providerRef == null && opts.providerRef)

  if (needsPatch) {
    await prisma.subscription.update({
      where: { id: (existing as any).id },
      data: {
        monthlyAmount: (existing as any).monthlyAmount ?? monthlyAmount,
        currency: (existing as any).currency ?? 'CZK',
        provider: (existing as any).provider ?? ('STRIPE' as any),
        providerRef: (existing as any).providerRef ?? (opts.providerRef ?? null),
      } as any,
    })
  }
}

/* =========================================================================
 * RAW router (webhook needs raw body; mount BEFORE express.json())
 * ========================================================================= */
export const rawRouter = Router()

rawRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripe) return res.status(500).send('Stripe not configured')
    if (!webhookSecret) return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET')
    if (!sig) return res.status(400).send('Missing Stripe-Signature')

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err: any) {
      console.error('[stripe webhook] signature verification failed:', err?.message)
      return res.status(400).send(`Webhook Error: ${err?.message}`)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const meta = (session.metadata || {}) as Record<string, string | undefined>

      const pledgeId = meta.pledgeId
      const animalId = meta.animalId
      const amountCZK = Number(meta.amountCZK || 0) // ✅ comes from checkout-session

      const stripeEmail =
        normalizeEmail((session as any).customer_details?.email) ||
        normalizeEmail(session.customer_email) ||
        normalizeEmail(((session.customer as any)?.email as string | undefined))

      const isPaid = (session.payment_status as string | undefined) === 'paid'

      // update pledge
      if (pledgeId) {
        try {
          await prisma.pledge.update({
            where: { id: pledgeId },
            data: {
              status: isPaid ? ('PAID' as any) : ('PENDING' as any),
              providerId: session.id,
              ...(stripeEmail ? { email: stripeEmail } : {}),
            } as any,
          })
        } catch {
          /* ignore */
        }
      }

      // ensure user + DB subscription
      if (stripeEmail && animalId && isPaid) {
        const clean = normalizeEmail(stripeEmail)!
        let user = await prisma.user.findUnique({ where: { email: clean } })
        if (!user) user = await prisma.user.create({ data: { email: clean, role: 'USER' } as any })

        await linkPaidOrRecentPledgesToUser(user.id, user.email)

        await ensureDbSubscriptionActive({
          userId: user.id,
          animalId,
          monthlyAmountCZK: amountCZK || 0, // must be present in metadata
          startedAt: new Date(),
          providerRef: session.id,
        })
      }
    }

    res.json({ received: true })
  } catch (e) {
    console.error('[stripe webhook] handler error:', e)
    res.status(500).send('Webhook handler error')
  }
})

/* =========================================================================
 * JSON router (normal JSON endpoints; mount AFTER express.json())
 * ========================================================================= */
const jsonRouter = Router()
jsonRouter.use(express.json())

jsonRouter.get('/ping', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    stripeKey: !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET),
    frontendBase: frontendBase(),
  })
})

/**
 * POST /api/stripe/checkout-session
 * body: { animalId, amountCZK, email, name, password }
 *
 * ✅ also writes amountCZK into Stripe metadata so webhook/confirm can create DB subscription
 */
jsonRouter.post('/checkout-session', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe is not configured on server' })

    const { animalId, amountCZK, email, name, password } = (req.body || {}) as {
      animalId?: string
      amountCZK?: number
      email?: string
      name?: string
      password?: string
    }

    if (!animalId || typeof animalId !== 'string') return res.status(400).json({ error: 'Missing or invalid animalId' })

    const amt = Math.round(Number(amountCZK || 0))
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Missing or invalid amountCZK' })

    // ✅ minimum 50 CZK / month
    if (amt < 50) return res.status(400).json({ error: 'Minimum is 50 CZK / měsíc' })

    // ✅ prefer JWT email if logged in
    const jwtUser = getOptionalJwt(req)
    const jwtEmail = normalizeEmail(jwtUser?.email)
    const bodyEmail = normalizeEmail(email)

    const resolvedEmail = jwtEmail || bodyEmail
    const safeEmail = resolvedEmail ?? 'pending+unknown@local'

    // optional: set password
    if (safeEmail !== 'pending+unknown@local') {
      const pwd = typeof password === 'string' && password.length >= 6 ? password : undefined
      if (pwd) {
        const passwordHash = await bcrypt.hash(pwd, 10)
        const existing = await prisma.user.findUnique({ where: { email: safeEmail } })
        if (!existing) {
          await prisma.user.create({ data: { email: safeEmail, role: 'USER', passwordHash } as any })
        } else if (!(existing as any).passwordHash) {
          await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } as any })
        }
      }
    }

    // create pledge (pending)
    const pledge = await prisma.pledge.create({
      data: {
        animalId,
        email: safeEmail,
        name: name ?? null,
        amount: amt,
        interval: 'MONTHLY' as any,
        method: 'CARD' as any,
        status: 'PENDING' as any,
      } as any,
      select: { id: true },
    })

    const FRONTEND_BASE = frontendBase()
    const successUrl = `${FRONTEND_BASE}/zvire/${encodeURIComponent(animalId)}?paid=1&sid={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${FRONTEND_BASE}/zvire/${encodeURIComponent(animalId)}?canceled=1`

    let customerId: string | undefined
    if (resolvedEmail) customerId = await getOrCreateCustomerId(resolvedEmail)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      locale: 'cs',
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerId ? { customer: customerId } : { customer_email: resolvedEmail }),
      customer_update: { name: 'auto' },
      metadata: {
        animalId,
        pledgeId: pledge.id,
        amountCZK: String(amt), // ✅ critical for DB subscription creation
        interval: 'MONTHLY',
        type: 'DONATION',
      },
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: {
              name: name ? `Měsíční dar: ${name}` : 'Měsíční dar na péči o psa',
              description: `Pravidelný měsíční příspěvek pro zvíře (${animalId})`,
            },
            unit_amount: Math.round(amt * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
    })

    await prisma.pledge.update({ where: { id: pledge.id }, data: { providerId: session.id } as any })

    res.json({ id: session.id, url: session.url })
  } catch (e: any) {
    console.error('[stripe checkout-session] error:', e)
    res.status(500).json({ error: 'Failed to create checkout session', detail: e?.message || String(e) })
  }
})

/**
 * GET /api/stripe/confirm?sid=cs_...
 * ✅ confirms payment + ensures DB subscription ACTIVE immediately
 */
jsonRouter.get('/confirm', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe is not configured on server' })

    const sid = String(req.query.sid || '')
    if (!sid) return res.status(400).json({ error: 'Missing sid' })

    const session = await stripe.checkout.sessions.retrieve(sid, { expand: ['customer', 'subscription'] })

    const isPaid = (session.payment_status as string | undefined) === 'paid'

    const stripeEmail =
      normalizeEmail((session as any).customer_details?.email) ||
      normalizeEmail(session.customer_email) ||
      normalizeEmail(((session.customer as any)?.email as string | undefined))

    const meta = (session.metadata || {}) as Record<string, string | undefined>
    const pledgeId = meta.pledgeId
    const animalId = meta.animalId
    const amountCZK = Number(meta.amountCZK || 0)

    // update pledge
    if (pledgeId) {
      try {
        await prisma.pledge.update({
          where: { id: pledgeId },
          data: {
            status: isPaid ? ('PAID' as any) : ('PENDING' as any),
            providerId: session.id,
            ...(stripeEmail ? { email: stripeEmail } : {}),
          } as any,
        })
      } catch {
        /* ignore */
      }
    }

    let token: string | undefined
    let returnedEmail: string | undefined = stripeEmail

    if (stripeEmail) {
      const clean = normalizeEmail(stripeEmail)!
      let user = await prisma.user.findUnique({ where: { email: clean } })
      if (!user) user = await prisma.user.create({ data: { email: clean, role: 'USER' } as any })

      await linkPaidOrRecentPledgesToUser(user.id, user.email)

      if (isPaid && animalId) {
        await ensureDbSubscriptionActive({
          userId: user.id,
          animalId,
          monthlyAmountCZK: amountCZK || 0,
          startedAt: new Date(),
          providerRef: session.id,
        })
      }

      token = signToken({ id: user.id, role: user.role, email: user.email })
      returnedEmail = user.email
    }

    res.json({ ok: true, token, email: returnedEmail, status: isPaid ? 'PAID' : 'PENDING' })
  } catch (e: any) {
    console.error('[stripe confirm] error:', e)
    res.status(500).json({ error: 'Failed to confirm session', detail: e?.message || String(e) })
  }
})

export default jsonRouter