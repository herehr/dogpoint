// backend/src/controllers/stripe.ts
import dotenv from 'dotenv'
dotenv.config()

import { Request, Response } from 'express'
import Stripe from 'stripe'

// Lazy init to avoid crashing when env is missing at import time
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (stripeClient) return stripeClient
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing – set it in backend .env')
  stripeClient = new Stripe(key as string)
  return stripeClient
}

/** POST /api/stripe/checkout-session */
export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  try {
    const { animalId, amountCZK, email, name } = (req.body || {}) as {
      animalId?: string
      amountCZK?: number
      email?: string
      name?: string
    }

    if (!animalId) { res.status(400).send('animalId required'); return }
    const amt = Number(amountCZK)
    if (!Number.isFinite(amt) || amt <= 0) { res.status(400).send('amountCZK must be a positive number'); return }

    const stripe = getStripe()
    const amountHaler = Math.round(amt * 100)

    const FRONTEND_BASE = (process.env.FRONTEND_BASE_URL || process.env.PUBLIC_WEB_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')

    // ✅ Redirect to ROOT (/) with query params to avoid server 404 on deep links
    const successUrl = `${FRONTEND_BASE}/?paid=1&animal=${encodeURIComponent(animalId)}`
    const cancelUrl  = `${FRONTEND_BASE}/?canceled=1&animal=${encodeURIComponent(animalId)}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'cs', // Czech UI
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'czk', // lock to CZK
            product_data: {
              name: `Měsíční adopce – ${animalId}`,
              description: name ? `Dárce: ${name}` : undefined,
            },
            unit_amount: amountHaler,
          },
          quantity: 1,
        },
      ],
      currency: 'czk',
      allow_promotion_codes: false,
      payment_method_options: { card: { request_three_d_secure: 'automatic' } },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    if (!session.url) { res.status(500).send('Stripe session missing URL'); return }
    res.json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe] createCheckoutSession error:', err)
    res.status(500).send(err?.message || 'Internal error')
  }
}