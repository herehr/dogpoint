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
 * Ensure an ACTIVE subscription exists for (userId, animalId) and
 * record a (unique-ish) initial paid payment if not already recorded.
 */
async function ensureActiveSubscriptionWithPayment(opts: {
  userId: string
  animalId: string
  monthlyAmountCZK: number
  provider: PaymentProvider
  providerRef?: string | null
}) {
  const { userId, animalId, monthlyAmountCZK, provider, providerRef } = opts

  // Composite unique exists: @@unique([userId, animalId, status])
  const sub = await prisma.subscription.upsert({
    where: {
      // Prisma generates `userId_animalId_status` input even if you didn't name it,
      // because of the @@unique([userId, animalId, status]).
      userId_animalId_status: {
        userId,
        animalId,
        status: SubscriptionStatus.ACTIVE,
      },
    },
    update: {},
    create: {
      userId,
      animalId,
      monthlyAmount: monthlyAmountCZK,
      currency: 'CZK',
      provider,
      providerRef: providerRef ?? null,
      status: SubscriptionStatus.ACTIVE,
      startedAt: new Date(),
    },
  })

  // You don't have @@unique([subscriptionId, providerRef]) in Payment,
  // so prevent duplicates with a findFirst guard:
  if (providerRef) {
    const existing = await prisma.payment.findFirst({
      where: { subscriptionId: sub.id, providerRef },
      select: { id: true },
    })
    if (!existing) {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          provider,
          providerRef,
          amount: monthlyAmountCZK,
          currency: 'CZK',
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      })
    }
  } else {
    // No providerRef, just create one paid record (low risk of duplicates)
    await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        provider,
        providerRef: null,
        amount: monthlyAmountCZK,
        currency: 'CZK',
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    })
  }
}

/**
 * POST /api/auth/register-after-payment
 * Body: { email, password, name? }
 *
 * - Creates user (or sets password if missing)
 * - Finds Pledge rows with { email, status: PAID }
 * - For each, creates/ensures ACTIVE Subscription + initial PAID Payment
 * - Returns JWT { token, role }
 */
export async function registerAfterPayment(req: Request, res: Response) {
  try {
    const { email, password, name } = (req.body || {}) as {
      email?: string
      password?: string
      name?: string
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email required' })
      return
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }

    const hash = await bcrypt.hash(password, 10)

    // Create or complete user
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: hash,
          role: Role.USER,
        },
      })
    } else if (!user.passwordHash) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      })
    }

    // Convert PAID pledges for this email into ACTIVE subscriptions + initial payment
    const paidPledges = await prisma.pledge.findMany({
      where: { email, status: PaymentStatus.PAID },
      orderBy: { createdAt: 'asc' },
    })

    for (const pl of paidPledges) {
      await ensureActiveSubscriptionWithPayment({
        userId: user.id,
        animalId: pl.animalId,
        monthlyAmountCZK: pl.amount,
        provider: PaymentProvider.STRIPE, // your Stripe flow
        providerRef: pl.providerId ?? null, // Stripe session/intent id if you store it
      })
    }

    // JWT
    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('[register-after-payment] error:', e)
    res.status(500).json({ error: e?.message ?? 'Registration failed' })
  }
}