// backend/src/lib/stripe.ts
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_API_KEY
if (!stripeKey) throw new Error('STRIPE_API_KEY not set')

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-06-20'
})