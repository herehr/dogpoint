// src/lib/stripe.ts
import Stripe from 'stripe'

const key = process.env.STRIPE_API_KEY
if (!key) {
  throw new Error('Stripe: STRIPE_API_KEY missing')
}

// ✅ Let the SDK use its pinned version; no literal-mismatch error
export const stripe = new Stripe(key)