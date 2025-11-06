// backend/src/routes/gpwebpay.ts
import express, { Router, Request, Response, NextFunction } from 'express'
import {
  createPledgePayment,
  returnHandler,
  notifyHandler,
  getByOrder,
} from '../controllers/gpwebpayController'

// Feature-flag: only enable routes if required envs are set
function gpEnabled(): boolean {
  const {
    GP_MERCHANT_NUMBER,
    GP_GATEWAY_BASE,
    GP_PRIVATE_KEY_PEM,
    GP_PUBLIC_KEY_PEM,
  } = process.env
  return Boolean(
    GP_MERCHANT_NUMBER &&
      GP_GATEWAY_BASE &&
      GP_PRIVATE_KEY_PEM &&
      GP_PUBLIC_KEY_PEM
  )
}

// Middleware that returns 501 if GP webpay is not configured
function requireGpReady(_req: Request, res: Response, next: NextFunction) {
  if (!gpEnabled()) {
    res.status(501).json({ error: 'GP webpay not configured' })
    return
  }
  next()
}

const router = Router()

/**
 * Create payment and redirect the user to GP webpay
 * Body: { animalId: string, email: string, name?: string, amount: number, note?: string }
 * Returns: { ok, pledgeId, pledgePaymentId, orderNumber, redirectUrl }
 */
router.post('/create', requireGpReady, createPledgePayment)

/**
 * Browser return URL (GET)
 * Verifies signature, updates DB, and redirects back to the app.
 */
router.get('/return', requireGpReady, returnHandler)

/**
 * Server-to-server notification (POST or GET)
 * IMPORTANT: GP often POSTs as application/x-www-form-urlencoded.
 * We add urlencoded() just for this route. The controller itself is idempotent and
 * will 200 OK even if not configured (so we *don’t* requireGpReady here).
 */
router.post('/notify', express.urlencoded({ extended: false }), notifyHandler)
router.get('/notify', notifyHandler)

/**
 * Lookup by ORDERNUMBER (stored in pledgePayment.providerId)
 */
router.get('/order/:order', requireGpReady, getByOrder)

export default router