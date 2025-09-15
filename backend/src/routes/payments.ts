// backend/src/routes/payments.ts
import { Router, Request, Response } from 'express'
import Stripe from 'stripe';

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || ''),

/**
 * POST /api/payments/stripe/checkout
 * Body: { amountCZK: number; animalId: string; email?: string; name?: string }
 * Creates a Stripe Checkout session (subscription, monthly) and returns { url }
 */
router.post('/stripe/checkout', async (req: Request, res: Response) => {
  try {
    const { amountCZK, animalId, email, name } = (req.body || {}) as {
      amountCZK?: number
      animalId?: string
      email?: string
      name?: string
    }

    if (!animalId) return res.status(400).json({ error: 'animalId required' })
    if (!amountCZK || amountCZK < 100) return res.status(400).json({ error: 'amountCZK >= 100' })

    // Create / reuse customer by email (optional)
    let customerId: string | undefined
    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 })
      const customer = existing.data[0] || (await stripe.customers.create({ email, name }))
      customerId = customer.id
    }

    // Create a subscription-mode Checkout Session with inline price_data (monthly)
    // Stripe expects amounts in the smallest currency unit => CZK * 100
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // If you don’t have a customer yet & you want Stripe to collect email, add:
      // customer_email: customerId ? undefined : email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'czk',
            recurring: { interval: 'month' },
            product_data: {
              name: `Adopce – měsíční podpora (${amountCZK} Kč)`,
              metadata: { animalId },
            },
            unit_amount: Math.round(amountCZK * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_BASE_URL}/platba/uspech?session_id={CHECKOUT_SESSION_ID}&animal=${encodeURIComponent(animalId)}`,
      cancel_url: `${process.env.APP_BASE_URL}/platba/zruseno?animal=${encodeURIComponent(animalId)}`,
      // Tag the session so webhooks can attach to your domain data
      metadata: { animalId, email: email || '', name: name || '' },
    })

    return res.json({ url: session.url })
  } catch (e: any) {
    console.error('POST /api/payments/stripe/checkout error:', e)
    return res.status(500).json({ error: 'Failed to create Stripe session' })
  }
})

export default router