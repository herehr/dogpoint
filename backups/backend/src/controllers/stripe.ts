// backend/src/controllers/stripe.ts
import type { Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma'
import { PaymentStatus, PaymentMethod } from '@prisma/client'

// --- Stripe init -------------------------------------------------------------
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
if (!STRIPE_KEY) {
  // Don’t throw at module load to keep the process booting for other routes
  console.warn('[stripe] Missing STRIPE_SECRET_KEY in environment.')
}
const stripe = STRIPE_KEY
  ? new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' as any })
  : (null as unknown as Stripe)

// --- helpers -----------------------------------------------------------------
function intCZK(amountCZK: number) {
  // Stripe prices are in the smallest currency unit; CZK has 2 decimals.
  return Math.round(amountCZK * 100)
}
function webBase() {
  // Where to send the user back after checkout
  return process.env.PUBLIC_WEB_BASE_URL
    || process.env.FRONTEND_BASE_URL
    || 'https://example.com'
}

// --- Controller: create checkout session -------------------------------------
export async function createCheckoutSession(req: Request, res: Response) {
  try {
    if (!stripe) {
      res.status(500).json({ error: 'Stripe not configured on the server.' })
      return
    }

    const { animalId, amountCZK, email, name } = (req.body || {}) as {
      animalId?: string
      amountCZK?: number
      email?: string
      name?: string
    }

    // Basic guards
    if (!animalId || typeof animalId !== 'string') {
      res.status(400).json({ error: 'animalId required' })
      return
    }
    if (!amountCZK || typeof amountCZK !== 'number' || amountCZK <= 0) {
      res.status(400).json({ error: 'amountCZK must be a positive number' })
      return
    }
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email required' })
      return
    }

    // Create a Pledge (lightweight pre-record)
    const pledge = await prisma.pledge.create({
      data: {
        animalId,
        email,
        name: name ?? null,
        amount: amountCZK,
        interval: 'MONTHLY',
        method: PaymentMethod.CARD,
        status: PaymentStatus.PENDING,
        providerId: null,
        note: null,
      },
    })

    // Create a PledgePayment in PENDING
    const pledgePayment = await prisma.pledgePayment.create({
      data: {
        pledgeId: pledge.id,
        status: PaymentStatus.PENDING,
        amount: amountCZK,
        currency: 'CZK',
        provider: 'stripe',
        providerId: null,
        // raw must be undefined or valid JSON, not null
        raw: undefined,
      },
    })

    // Build success/cancel URLs
    const base = webBase()
    // Route you actually have in the frontend:
    // - either /po-platbe or /zvirata/:id?paid=1 — keep what you use
    const successUrl = `${base}/po-platbe?ok=1&animal=${encodeURIComponent(animalId)}&email=${encodeURIComponent(email)}`
    const cancelUrl  = `${base}/po-platbe?canceled=1&animal=${encodeURIComponent(animalId)}`

    // Create Stripe Checkout Session (one-time payment in CZK)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'czk',
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: {
              name: `Adopce: ${animalId}`,
              description: name ? `Dárce: ${name}` : 'Děkujeme za podporu!',
            },
            unit_amount: intCZK(amountCZK),
          },
          quantity: 1,
        },
      ],
      // prefill email if provided
      customer_email: email,
      // localize Checkout — Stripe will also auto-detect
      locale: 'cs',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        animalId,
        pledgeId: pledge.id,
        pledgePaymentId: pledgePayment.id,
        app: 'dogpoint',
      },
    })

    // Store the session id on pledge + pledgePayment
    await prisma.pledge.update({
      where: { id: pledge.id },
      data: { providerId: session.id },
    })
    await prisma.pledgePayment.update({
      where: { id: pledgePayment.id },
      data: { providerId: session.id },
    })

    res.json({ url: session.url })
  } catch (e: any) {
    console.error('[stripe.createCheckoutSession] error:', e)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
}

// --- Controller: webhook (mounted on raw router) -----------------------------
export async function webhook(req: Request, res: Response) {
  try {
    if (!stripe) {
      res.status(500).send('Stripe not configured')
      return
    }

    const sig = req.headers['stripe-signature'] as string | undefined
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET
    let event: Stripe.Event

    if (whSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent((req as any).body, sig, whSecret)
      } catch (err: any) {
        console.error('[stripe.webhook] signature verification failed:', err?.message)
        res.status(400).send(`Webhook Error: ${err.message}`)
        return
      }
    } else {
      // Accept unsigned (dev/test) — not recommended for production
      event = req.body as any
    }

    // Persist raw webhook event (optional)
    await prisma.webhookEvent.create({
      data: {
        provider: 'STRIPE',
        rawPayload: event as unknown as object, // Prisma Json type
      },
    })

    // Handle completion
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionId = session.id

      // Find the pledgePayment by providerId (session.id)
      const pp = await prisma.pledgePayment.findFirst({
        where: { providerId: sessionId },
        include: { pledge: true },
      })

      if (pp) {
        // Mark payment/pledge as PAID
        await prisma.pledgePayment.update({
          where: { id: pp.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            // save a small JSON snippet; avoid null
            raw: {
              eventId: event.id,
              type: event.type,
              amount_total: session.amount_total,
              currency: session.currency,
            } as any,
          },
        })

        await prisma.pledge.update({
          where: { id: pp.pledgeId },
          data: {
            status: PaymentStatus.PAID,
            providerId: sessionId, // keep consistent
          },
        })

        // Do NOT attempt to use pledge.userId (doesn’t exist).
        // Linking to real user is handled in /api/auth/register-after-payment
        // by email once the donor sets a password.
      }
    }

    res.status(200).send('ok')
  } catch (e: any) {
    console.error('[stripe.webhook] error:', e)
    res.status(500).send('webhook error')
  }
}