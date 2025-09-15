// backend/src/routes/payments.ts
import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma'

const router = Router()

// Stripe client – leave apiVersion omitted to use SDK default
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || ''
const stripe = new Stripe(STRIPE_SECRET)

const FRONTEND_BASE = (process.env.FRONTEND_BASE_URL || '').replace(/\/+$/,'') || 'http://localhost:5173'
const BACKEND_BASE = (process.env.BACKEND_BASE_URL || '').replace(/\/+$/,'') || 'http://localhost:3000'

/**
 * POST /api/payments/stripe/checkout
 * body: { animalId: string, email: string, name?: string, monthly: number }
 * Creates a Stripe Checkout Session in "subscription" mode with a dynamic monthly CZK amount.
 */
router.post('/stripe/checkout', async (req: Request, res: Response) => {
  try {
    const { animalId, email, name, monthly } = (req.body || {}) as {
      animalId?: string; email?: string; name?: string; monthly?: number
    }
    if (!STRIPE_SECRET) return res.status(500).json({ error: 'Server misconfigured (STRIPE_SECRET_KEY)' })
    if (!animalId) return res.status(400).json({ error: 'animalId required' })
    if (!email) return res.status(400).json({ error: 'email required' })
    const amt = Number(monthly)
    if (!Number.isFinite(amt) || amt < 300) return res.status(400).json({ error: 'monthly must be >= 300' })

    // Ensure animal exists
    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) }, select: { id: true, jmeno: true, name: true } })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    // Find or create user by email
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({ data: { email, role: 'USER' } })
    }

    // Create or reuse an AdoptionRequest in NEW/PENDING
    const ar = await prisma.adoptionRequest.create({
      data: {
        animalId: animal.id,
        email,
        name: name || 'Adoptující',
        monthly: Math.round(amt),
        status: 'PENDING', // will switch to APPROVED on webhook or return
      },
    })

    // Create a dynamic-price subscription item (CZK monthly)
    const productName = `Adopce – ${animal.jmeno || animal.name || 'Zvíře'}`
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${FRONTEND_BASE}/zvirata/${animal.id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_BASE}/zvirata/${animal.id}?canceled=1`,
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: { name: productName },
            unit_amount: Math.round(amt * 100), // CZK → haléře
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      metadata: {
        animalId: animal.id,
        userId: user.id,
        adoptionRequestId: ar.id,
      },
    })

    // Persist session id for later reconciliation
    await prisma.adoptionRequest.update({
      where: { id: ar.id },
      data: { stripeCheckoutSessionId: session.id },
    })

    return res.json({ ok: true, url: session.url })
  } catch (e: any) {
    console.error('POST /api/payments/stripe/checkout error', e)
    return res.status(500).json({ error: 'Internal error creating checkout session' })
  }
})

export default router