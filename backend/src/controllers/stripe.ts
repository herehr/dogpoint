// backend/src/controllers/stripe.ts
import { Request, Response } from 'express'
import Stripe from 'stripe'

const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
// Omit apiVersion to avoid type clashes across Stripe SDK versions
export const stripe = new Stripe(stripeSecret)

type CheckoutBody = {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // switch to 'subscription' with a price ID if needed
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
    res.status(500).send(String(err?.message || err))
  }
}