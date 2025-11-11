// backend/src/controllers/stripeWebhook.ts
import dotenv from 'dotenv'
dotenv.config()

import { Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../prisma'
import { PaymentStatus, PaymentMethod } from '@prisma/client'

let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (stripeClient) return stripeClient
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  if (!key) throw new Error('STRIPE_SECRET_KEY missing')
  stripeClient = new Stripe(key as string)
  return stripeClient
}

/**
 * RAW body required. Mount this route with express.raw({ type: 'application/json' }).
 */
export async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    if (!endpointSecret || !sig) {
      // Fallback: accept unverified (not recommended in production)
      event = req.body as any
    } else {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody ? (req as any).rawBody : (req as any).body, // DO passes rawBody if set in route
        sig as string,
        endpointSecret
      )
    }
  } catch (err: any) {
    console.error('[stripe] webhook signature verify failed:', err?.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const email = (session.customer_email || session.customer_details?.email || session.metadata?.email || '').trim()
      const animalId = (session.client_reference_id || session.metadata?.animalId || '').trim()
      const currency = (session.currency || 'czk').toUpperCase()
      const amountCZK = session.amount_total ? Math.round(Number(session.amount_total) / 100) : undefined

      if (!animalId) {
        console.warn('[stripe] session completed without animalId metadata')
        res.json({ received: true })
        return
      }

      // Create or update a pledge as PAID
      let pledge = await prisma.pledge.findFirst({
        where: { email, animalId }
      })

      if (!pledge) {
        pledge = await prisma.pledge.create({
          data: {
            animalId,
            email: email || 'unknown@example.com',
            amount: amountCZK ?? 0,
            interval: 'MONTHLY',
            method: PaymentMethod.CARD,
            status: PaymentStatus.PAID,
            providerId: session.id,
            note: null,
          }
        })
      } else {
        pledge = await prisma.pledge.update({
          where: { id: pledge.id },
          data: {
            status: PaymentStatus.PAID,
            providerId: session.id,
          }
        })
      }

      // Record pledge payment
      await prisma.pledgePayment.create({
        data: {
          pledgeId: pledge.id,
          status: PaymentStatus.PAID,
          amount: amountCZK ?? pledge.amount,
          provider: 'stripe',
          providerId: (session.payment_intent as string) || session.id,
          raw: event as any,
        }
      })
    }

    res.json({ received: true })
  } catch (e: any) {
    console.error('[stripe] webhook handler error:', e)
    res.status(500).send('Webhook handler error')
  }
}