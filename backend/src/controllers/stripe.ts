import { Request, Response } from 'express'
import Stripe from 'stripe'

const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ''
export const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

/**
 * POST /api/payments/stripe/checkout
 * body: { animalId: string; amountCZK: number; email?: string; name?: string }
 * Returns: { url: string }
 */
export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { animalId, amountCZK, email, name } = req.body as {
      animalId: string
      amountCZK: number
      email?: string
      name?: string
    }

    if (!animalId || typeof animalId !== 'string') {
      return res.status(400).send('animalId required')
    }
    if (typeof amountCZK !== 'number' || !Number.isFinite(amountCZK) || amountCZK <= 0) {
      return res.status(400).send('amountCZK must be a positive number')
    }

    // convert CZK to the smallest unit (haléř) for Stripe amount-based pricing
    const amountHaler = Math.round(amountCZK * 100)

    // This example uses a one-time payment session.
    // If you need subscriptions, swap to `mode: 'subscription'` and use a price ID.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'czk',
          product_data: { name: `Adopce – ${animalId}`, description: name ? `Dárce: ${name}` : undefined },
          unit_amount: amountHaler,
        },
        quantity: 1,
      }],
      success_url: `${process.env.PUBLIC_WEB_BASE_URL || 'https://example.com'}/zvirata/${encodeURIComponent(animalId)}?paid=1`,
      cancel_url: `${process.env.PUBLIC_WEB_BASE_URL || 'https://example.com'}/zvirata/${encodeURIComponent(animalId)}?canceled=1`,
    })

    if (!session.url) return res.status(500).send('Stripe session missing URL')
    return res.json({ url: session.url })
  } catch (err: any) {
    return res.status(500).send(String(err?.message || err))
  }
}