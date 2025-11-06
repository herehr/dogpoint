// backend/src/routes/stripe.ts
import express, { Router } from 'express'
import { createCheckoutSession } from '../controllers/stripe'
import { stripeWebhook } from '../controllers/stripeWebhook'

/**
 * Export two routers:
 * - rawRouter: only for /webhook (needs express.raw)
 * - jsonRouter: normal JSON routes
 */
export const rawRouter = Router()
rawRouter.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

const jsonRouter = Router()
jsonRouter.post('/checkout-session', createCheckoutSession)

export default jsonRouter