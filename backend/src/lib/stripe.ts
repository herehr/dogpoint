// backend/src/lib/stripe.ts
import Stripe from 'stripe'

const key = process.env.STRIPE_API_KEY
if (!key) {
  // Fail fast at startup with a clear message
  throw new Error('STRIPE_API_KEY is not set')
}

/**
 * Pin to an API version that exists in the stripe typings.
 * Newest SDKs accept a union including Stripe.LatestApiVersion; keeping a
 * concrete, stable version avoids “type mismatch” surprises in CI.
 */
const apiVersion: Stripe.LatestApiVersion | '2024-06-20' = '2024-06-20'

export const stripe = new Stripe(key, { apiVersion })