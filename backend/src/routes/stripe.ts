// backend/src/routes/stripe.ts
import express, { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import jwt, { Secret } from 'jsonwebtoken'
import bcrypt from 'bcrypt'
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

function normalizeEmail(x?: string | null): string | undefined {
  const s = (x ?? '').trim().toLowerCase()
  return s ? s : undefined
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
        // @ts-ignore optional table
        await prisma.webhookEvent?.create?.({
          data: { provider: 'STRIPE', rawPayload: event as any, processed: false },
        })
      } catch { /* ignore */ }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const pledgeId = (session.metadata as any)?.pledgeId as string | undefined
        const stripeEmail =
        normalizeEmail(
        // the most reliable field after checkout:
         (session as any).customer_details?.email
         ) ||
        normalizeEmail(session.customer_email) ||
        normalizeEmail(((session.customer as any)?.email as string | undefined));

        // Update pledge → PAID (+ patch email if placeholder)
        if (pledgeId) {
          try {
            await prisma.pledge.update({
              where: { id: pledgeId },
              data: {
                status: 'PAID',
                providerId: session.id,
                ...(stripeEmail ? { email: stripeEmail } : {}),
              },
            })
          } catch { /* ignore */ }
        } else {
          const p = await prisma.pledge.findFirst({ where: { providerId: session.id } })
          if (p) {
            try {
              await prisma.pledge.update({
                where: { id: p.id },
                data: {
                  status: 'PAID',
                  ...(stripeEmail ? { email: stripeEmail } : {}),
                },
              })
            } catch { /* ignore */ }
          }
        }

        // Ensure user + link pledges
        const emailToUse =
          stripeEmail ||
          (await (async () => {
            const p = await prisma.pledge.findFirst({ where: { providerId: session.id } })
            return p?.email
          })())

        if (emailToUse) {
          let user = await prisma.user.findUnique({ where: { email: emailToUse } })
          if (!user) user = await prisma.user.create({ data: { email: emailToUse, role: 'USER' } })
          await linkPaidOrRecentPledgesToUser(user.id, emailToUse)
        }
      }

      // mark processed if you keep a log table
      try {
        // @ts-ignore optional table
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

/** Simple readiness probe */
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
 * Uses a placeholder email if none provided; Stripe email overwrites it after payment.
 */
jsonRouter.post('/checkout-session', async (req: Request, res: Response) => {
  try {
    const { animalId, amountCZK, email, name, password } = (req.body || {}) as {
      animalId?: string
      amountCZK?: number
      email?: string
      name?: string
      password?: string
    }

    if (!animalId || typeof animalId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid animalId' })
      return
    }
    if (!amountCZK || typeof amountCZK !== 'number' || amountCZK <= 0) {
      res.status(400).json({ error: 'Missing or invalid amountCZK' })
      return
    }

    const safeEmail = normalizeEmail(email) ?? 'pending+unknown@local'

     // -------------------------------------------------------------
    // Create / update user right here (with password)
    // -------------------------------------------------------------
    let userId: string | undefined

    // We only bother if the email is real (not the placeholder)
    if (safeEmail && safeEmail !== 'pending+unknown@local') {
      const pwd = typeof password === 'string' && password.length >= 6 ? password : undefined

      if (pwd) {
        const passwordHash = await bcrypt.hash(pwd, 10)

        // NOTE: adjust 'passwordHash' if your User model uses a different field name
        let existing = await prisma.user.findUnique({
          where: { email: safeEmail },
        })

        if (!existing) {
          const created = await prisma.user.create({
            data: {
              email: safeEmail,
              role: 'USER',
              passwordHash,
            } as any,
          })
          userId = created.id
        } else {
          // If user exists but has no password yet → set it
          // Again: adjust 'passwordHash' according to your Prisma schema.
          if (!(existing as any).passwordHash) {
            const updated = await prisma.user.update({
              where: { id: existing.id },
              data: { passwordHash } as any,
            })
            userId = updated.id
          } else {
            userId = existing.id
          }
        }
      }
    }


    // NB: Your Pledge model doesn't accept `provider`. We only set allowed fields.
    const pledge = await prisma.pledge.create({
      data: {
        animalId,
        email: safeEmail,
        name: name ?? null,
        amount: amountCZK,
        interval: 'MONTHLY' as any,
        method: 'CARD' as any,
        status: 'PENDING' as any,
        // providerId is set after we create the Stripe session
      } as any,
      select: { id: true },
    })

    const FRONTEND_BASE = frontendBase()

    // ✅ After payment (or pending) → go to “Moje adopce” (/user) with sid + paid=1
    const successUrl = `${FRONTEND_BASE}/user?paid=1&sid={CHECKOUT_SESSION_ID}`

    // ❌ User cancels payment → back to public detail (locked)
    const cancelUrl = `${FRONTEND_BASE}/zvire/${encodeURIComponent(
      animalId
    )}?canceled=1`


    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'cs',
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency: 'czk',
      customer_email: normalizeEmail(email),
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

    await prisma.pledge.update({
      where: { id: pledge.id },
      data: { providerId: session.id },
    })

    res.json({ id: session.id, url: session.url })
  } catch (e: any) {
    console.error('[stripe checkout-session] error:', e)
    res.status(500).json({
      error: 'Failed to create checkout session',
      detail: e?.message || String(e),
    })
  }
})

/**
 * GET /api/stripe/confirm?sid=cs_...
 * For instant confirmation at success redirect.
 * Returns { ok: true, token?: string, email?: string }
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

    const stripeEmail =
  normalizeEmail((session as any).customer_details?.email) ||
  normalizeEmail(session.customer_email) ||
  normalizeEmail(((session.customer as any)?.email as string | undefined));

const meta = (session.metadata || {}) as Record<string, string | undefined>;
const pledgeId = meta.pledgeId;

    // Mark pledge PAID and patch email if we have it
    try {
  if (pledgeId) {
    await prisma.pledge.update({
      where: { id: pledgeId },
      data: {
        status: 'PAID',
        providerId: session.id,
        ...(stripeEmail ? { email: stripeEmail } : {}),
      },
    });
  } else {
    const p = await prisma.pledge.findFirst({ where: { providerId: sid } });
    if (p) {
      await prisma.pledge.update({
        where: { id: p.id },
        data: {
          status: 'PAID',
          ...(stripeEmail ? { email: stripeEmail } : {}),
        },
      });
    }
  }
} catch { /* ignore */ }

    // ---------- Your requested block (integrated perfectly) ----------
    // earlier in the handler:
    // const stripeEmail = session.customer_email || ((session.customer as any)?.email as string | undefined);
    // (we already normalized to lower-case above)

    // resolve email: prefer Stripe → then pledge.providerId match
   let resolvedEmail: string | undefined = stripeEmail;
if (!resolvedEmail) {
  const p = await prisma.pledge.findFirst({
    where: { providerId: sid },
    select: { email: true },
  });
  if (p?.email) resolvedEmail = normalizeEmail(p.email);
}

    // normalize
    if (resolvedEmail) resolvedEmail = normalizeEmail(resolvedEmail)

   let token: string | undefined;
let returnedEmail: string | undefined = resolvedEmail;

if (resolvedEmail) {
  let user = await prisma.user.findUnique({ where: { email: resolvedEmail } });
  if (!user) user = await prisma.user.create({ data: { email: resolvedEmail, role: 'USER' } });
  await linkPaidOrRecentPledgesToUser(user.id, resolvedEmail);
  token = signToken({ id: user.id, role: user.role, email: user.email });
  returnedEmail = user.email; // normalized from DB
}

res.json({ ok: true, token, email: returnedEmail });
  } catch (e) {
    console.error('[stripe confirm] error:', e)
    res.status(500).json({ error: 'Failed to confirm session' })
  }
})

export default jsonRouter