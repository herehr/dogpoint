// backend/src/controllers/stripe.ts
import { Request, Response } from 'express'
import Stripe from 'stripe'

type CheckoutBody = {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
}

// Lazy initializer to avoid crashing at import time
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  if (!key) {
    throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY).')
  }
  if (!_stripe) {
    // Omit apiVersion to avoid type clashes across Stripe SDK versions (as you had)
    _stripe = new Stripe(key)
  }
  return _stripe
}

export async function createCheckoutSession(
  req: Request<unknown, unknown, CheckoutBody>,
  res: Response
): Promise<void> {
  try {
    const { animalId, amountCZK, email, name } = req.body || ({} as CheckoutBody)

    if (!animalId || typeof animalId !== 'string') {
      res.status(400).send('animalId required')
      return
    }
    if (typeof amountCZK !== 'number' || !Number.isFinite(amountCZK) || amountCZK <= 0) {
      res.status(400).send('amountCZK must be a positive number')
      return
    }

    const amountHaler = Math.round(amountCZK * 100)

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: {
              name: `Adopce – ${animalId}`,
              description: name ? `Dárce: ${name}` : undefined,
            },
            unit_amount: amountHaler,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_WEB_BASE_URL || 'https://example.com'}/zvirata/${encodeURIComponent(
        animalId
      )}?paid=1`,
      cancel_url: `${process.env.PUBLIC_WEB_BASE_URL || 'https://example.com'}/zvirata/${encodeURIComponent(
        animalId
      )}?canceled=1`,
    })

    if (!session.url) {
      res.status(500).send('Stripe session missing URL')
      return
    }
    res.json({ url: session.url })
  } catch (err: any) {
    if (String(err?.message).includes('Stripe is not configured')) {
      res.status(503).send('Stripe není nakonfigurován (chybí STRIPE_SECRET_KEY).')
      return
    }
    res.status(500).send(String(err?.message || err))
  }
}