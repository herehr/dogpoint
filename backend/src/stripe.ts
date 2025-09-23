// backend/src/stripe.ts
import Stripe from 'stripe';

const key =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_API_KEY; // accept either name

if (!key) {
  // helpful error for DO logs
  throw new Error('Missing Stripe key. Set STRIPE_SECRET_KEY (preferred) or STRIPE_API_KEY.');
}

export const stripe = new Stripe(key, {
  apiVersion: '2023-10-16',
});