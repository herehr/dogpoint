// backend/src/routes/stripe.ts
import { Router } from 'express'
import { createCheckoutSession } from '../controllers/stripe'

const router = Router()

// Create a Stripe Checkout session
router.post('/checkout-session', createCheckoutSession)

// Optional: simple health check for debugging
router.get('/health', (req, res) => {
  if (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET) {
    return res.json({ ok: true })
  }
  return res.status(503).json({ ok: false, error: 'Stripe není nakonfigurován.' })
})

export default router