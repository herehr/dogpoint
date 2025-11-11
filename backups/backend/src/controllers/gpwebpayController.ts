// backend/src/controllers/gpwebpayController.ts
import type { Request, Response } from 'express'
import { PaymentStatus } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '../prisma'
import { buildRedirectUrl, verifySignature } from '../payments/gpwebpay'

const {
  GP_MERCHANT_NUMBER,
  GP_DEPOSIT_FLAG,
  GP_CURRENCY,
  GP_GATEWAY_BASE,
  GP_PRIVATE_KEY_PEM,
  GP_PRIVATE_KEY_PASS,
  GP_PUBLIC_KEY_PEM,
  APP_BASE_URL,
} = process.env

function gpReady(): boolean {
  return Boolean(
    GP_MERCHANT_NUMBER &&
      GP_GATEWAY_BASE &&
      GP_PRIVATE_KEY_PEM &&
      GP_PUBLIC_KEY_PEM
  )
}

function toCents(amount: number) {
  return Math.round(amount * 100)
}

/**
 * POST /api/gpwebpay/create
 * Body: { animalId: string, email: string, name?: string, amount: number, note?: string }
 * Creates Pledge + PledgePayment (PENDING) and returns { redirectUrl, orderNumber }
 */
export const createPledgePayment = async (req: Request, res: Response) => {
  try {
    if (!gpReady()) {
      res.status(501).json({ error: 'GP webpay not configured' })
      return
    }

    const { animalId, email, name, amount, note } = req.body as {
      animalId: string
      email: string
      name?: string
      amount: number
      note?: string
    }

    if (!animalId || typeof animalId !== 'string') {
      res.status(400).json({ error: 'animalId required' })
      return
    }
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email required' })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number (CZK)' })
      return
    }

    // 1) Create pledge intent
    const pledge = await prisma.pledge.create({
      data: {
        animalId,
        email,
        name: name ?? null,
        amount,
        interval: 'MONTHLY',
        method: 'CARD',
        status: 'PENDING',
        note: note ?? null,
      },
    })

    // 2) Generate gateway ORDERNUMBER (we’ll store it in providerId)
    const orderNumber = crypto.randomUUID().split('-')[0]
    const md = pledge.id // merchant data (free text); we reuse pledge.id

    // 3) Create pending PledgePayment
    const pledgePayment = await prisma.pledgePayment.create({
      data: {
        pledgeId: pledge.id,
        status: 'PENDING',
        amount,
        provider: 'gpwebpay',
        // we’ll set providerId to ORDERNUMBER right away so we can look it up later
        providerId: orderNumber,
        // put any extra info into raw JSON
        raw: {
          md,
          createdAt: new Date().toISOString(),
        },
      },
    })

    // 4) Build redirect URL to GP webpay
    const returnUrl = `${APP_BASE_URL || 'http://localhost:5173'}/platba/vysledek?order=${encodeURIComponent(
      orderNumber
    )}`

    const redirectUrl = buildRedirectUrl(
      GP_GATEWAY_BASE!,
      {
        merchantNumber: GP_MERCHANT_NUMBER!,
        orderNumber,
        amountCents: toCents(amount),
        currency: GP_CURRENCY || 'CZK',
        depositFlag: Number(GP_DEPOSIT_FLAG || 1) as 0 | 1,
        url: returnUrl,
        description: `Dar pro Dogpoint (${animalId})`,
        md,
      },
      GP_PRIVATE_KEY_PEM!,
      GP_PRIVATE_KEY_PASS || undefined
    )

    // 5) Respond with the gateway URL
    res.json({
      ok: true,
      pledgeId: pledge.id,
      pledgePaymentId: pledgePayment.id,
      orderNumber,
      redirectUrl,
    })
  } catch (err: any) {
    console.error('[GP createPledgePayment] error', err)
    res.status(500).json({ error: 'Failed to create payment' })
  }
}

/**
 * GET /api/gpwebpay/return
 * Browser return endpoint – verifies signature, updates payment status, redirects to result page.
 */
export const returnHandler = async (req: Request, res: Response) => {
  try {
    if (!gpReady()) {
      res.status(501).send('GP webpay not configured')
      return
    }

    // Normalize query values to strings
    const qRaw = req.query as Record<string, unknown>
    const q: Record<string, string> = {}
    for (const [k, v] of Object.entries(qRaw)) {
      if (typeof v === 'string') q[k] = v
      else if (Array.isArray(v) && typeof v[0] === 'string') q[k] = v[0]
    }

    const { ORDERNUMBER, MD, PRCODE, SRCODE, RESULTTEXT, DIGEST, ...restUntyped } = q
    const rest: Record<string, string> = restUntyped

    // Only include defined values for signature verification
    const signedParams: Record<string, string | number> = {}
    const src = { ORDERNUMBER, PRCODE, SRCODE, RESULTTEXT, ...rest, MD }
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'string' && v.length > 0) signedParams[k] = v
      else if (typeof v === 'number') signedParams[k] = v
    }

    const valid = !!(DIGEST && GP_PUBLIC_KEY_PEM && verifySignature(signedParams, DIGEST, GP_PUBLIC_KEY_PEM))

    // We stored ORDERNUMBER in providerId
    const pledgePayment = await prisma.pledgePayment.findFirst({
      where: { provider: 'gpwebpay', providerId: ORDERNUMBER || undefined },
    })
    if (!pledgePayment) {
      res.status(404).send('Payment not found')
      return
    }

    let status: PaymentStatus = 'FAILED'
    if (valid && PRCODE === '0' && SRCODE === '0') status = 'PAID'

    await prisma.pledgePayment.update({
      where: { id: pledgePayment.id },
      data: {
        status,
        // keep the latest payload
        raw: {
          ...(pledgePayment.raw as any),
          return: q,
          verified: valid,
          result: `${PRCODE ?? ''}/${SRCODE ?? ''}`,
          resultText: RESULTTEXT ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
    })

    if (status === 'PAID') {
      await prisma.pledge.update({
        where: { id: pledgePayment.pledgeId },
        data: { status: 'PAID' },
      })
    }

    const to = `${APP_BASE_URL || 'http://localhost:5173'}/platba/vysledek?order=${encodeURIComponent(
      ORDERNUMBER || ''
    )}`
    res.redirect(to)
  } catch (err) {
    console.error('[GP returnHandler] error', err)
    res.status(500).send('Return handler error')
  }
}

/**
 * POST/GET /api/gpwebpay/notify
 * Server-to-server notification – updates payment status, returns 200 always (idempotent).
 */
export const notifyHandler = async (req: Request, res: Response) => {
  try {
    if (!gpReady()) {
      res.status(200).send('OK') // no-op if not configured
      return
    }

    const raw = req.method === 'POST' ? (req.body as Record<string, unknown>) : (req.query as Record<string, unknown>)
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw || {})) {
      if (typeof v === 'string') payload[k] = v
      else if (typeof v === 'number' || typeof v === 'boolean') payload[k] = String(v)
      else if (Array.isArray(v) && typeof v[0] === 'string') payload[k] = v[0]
    }

    const { ORDERNUMBER, MD, PRCODE, SRCODE, RESULTTEXT, DIGEST, ...restUntyped } = payload
    const rest: Record<string, string> = restUntyped

    const signedParams: Record<string, string | number> = {}
    const src = { ORDERNUMBER, PRCODE, SRCODE, RESULTTEXT, ...rest, MD }
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'string' && v.length > 0) signedParams[k] = v
      else if (typeof v === 'number') signedParams[k] = v
    }

    const valid = !!(DIGEST && GP_PUBLIC_KEY_PEM && verifySignature(signedParams, DIGEST, GP_PUBLIC_KEY_PEM))

    const pledgePayment = await prisma.pledgePayment.findFirst({
      where: { provider: 'gpwebpay', providerId: ORDERNUMBER || undefined },
    })
    if (!pledgePayment) {
      // Acknowledge anyway to avoid retries
      res.status(200).send('OK')
      return
    }

    let status: PaymentStatus = 'FAILED'
    if (valid && PRCODE === '0' && SRCODE === '0') status = 'PAID'

    await prisma.pledgePayment.update({
      where: { id: pledgePayment.id },
      data: {
        status,
        raw: {
          ...(pledgePayment.raw as any),
          notify: payload,
          verified: valid,
          result: `${PRCODE ?? ''}/${SRCODE ?? ''}`,
          resultText: RESULTTEXT ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
    })

    if (status === 'PAID') {
      await prisma.pledge.update({
        where: { id: pledgePayment.pledgeId },
        data: { status: 'PAID' },
      })
    }

    res.status(200).send('OK')
  } catch (err) {
    console.error('[GP notifyHandler] error', err)
    res.status(500).send('ERR')
  }
}

/**
 * GET /api/gpwebpay/order/:order
 * Look up pledge payment by ORDERNUMBER (stored in providerId)
 */
export const getByOrder = async (req: Request, res: Response) => {
  const { order } = req.params
  const pp = await prisma.pledgePayment.findFirst({
    where: { provider: 'gpwebpay', providerId: order },
  })
  if (!pp) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json(pp)
}