// backend/src/controllers/authExtra.ts
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'
import {
  Role,
  PaymentProvider,
  SubscriptionStatus,
  PaymentStatus,
} from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'changeme'

/**
 * Links all paid pledges belonging to a donor's email
 * to their new user account, creating subscriptions & payments.
 */
export async function linkPaidPledgesToUser(userId: string, email: string) {
  const paidPledges = await prisma.pledge.findMany({
    where: { email, status: PaymentStatus.PAID },
  })

  for (const pledge of paidPledges) {
    // Upsert subscription
    const sub = await prisma.subscription.upsert({
      where: {
        userId_animalId_status: {
          userId,
          animalId: pledge.animalId,
          status: SubscriptionStatus.ACTIVE,
        },
      },
      update: {},
      create: {
        userId,
        animalId: pledge.animalId,
        monthlyAmount: pledge.amount,
        currency: 'CZK',
        provider: PaymentProvider.STRIPE,
        providerRef: pledge.providerId ?? undefined,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
      },
    })

    // Upsert first payment
    await prisma.payment.upsert({
      where: {
        subscriptionId_providerRef: {
          subscriptionId: sub.id,
          providerRef: pledge.providerId ?? 'unknown',
        },
      },
      update: {},
      create: {
        subscriptionId: sub.id,
        provider: PaymentProvider.STRIPE,
        providerRef: pledge.providerId ?? 'unknown',
        amount: pledge.amount,
        currency: 'CZK',
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    })

    // Mark pledge as linked
    await prisma.pledge.update({
      where: { id: pledge.id },
      data: { userId },
    })
  }
}

/**
 * POST /api/auth/register-after-payment
 * Called when a donor creates a password after paying via Stripe.
 */
export async function registerAfterPayment(req: Request, res: Response) {
  try {
    const { email, password, name } = (req.body || {}) as {
      email?: string
      password?: string
      name?: string
    }

    if (!email || typeof email !== 'string') {
      res.status(400).send('Email required')
      return
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).send('Password must be at least 6 chars')
      return
    }

    const hash = await bcrypt.hash(password, 10)

    // Ensure user exists
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, passwordHash: hash, name, role: Role.USER },
      })
    } else if (!user.passwordHash) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      })
    }

    // Link pledges → subscriptions & payments
    await linkPaidPledgesToUser(user.id, email)

    // Sign JWT for auto-login
    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('registerAfterPayment error:', e)
    res.status(500).send(e?.message || 'Registration failed')
  }
}