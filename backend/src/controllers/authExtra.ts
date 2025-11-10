// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

/**
 * Link all PAID pledges (and recent PENDING pledges within grace window)
 * to the given user. Creates/upsserts Subscription + initial Payment and
 * marks pledge as linked to user.
 */
export async function linkPaidOrRecentPledgesToUser(
  userId: string,
  email: string,
  opts: { pendingGraceMinutes?: number } = {}
) {
  const graceMin = opts.pendingGraceMinutes ?? 30
  const since = new Date(Date.now() - graceMin * 60_000)

  const pledges = await prisma.pledge.findMany({
    where: {
      email,
      OR: [
        { status: PaymentStatus.PAID },
        { status: PaymentStatus.PENDING, createdAt: { gte: since } },
      ],
    },
  })

  for (const pledge of pledges) {
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
        status: pledge.status === 'PAID' ? PaymentStatus.PAID : PaymentStatus.PENDING,
        paidAt: pledge.status === 'PAID' ? new Date() : null,
      },
    })

    if (!pledge.userId) {
      await prisma.pledge.update({ where: { id: pledge.id }, data: { userId } })
    }
  }
}