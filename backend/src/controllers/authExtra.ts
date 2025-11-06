// backend/src/controllers/authExtra.ts (helper export)
import { prisma } from '../prisma'
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

export async function linkPaidPledgesToUser(userId: string, email: string) {
  // 1) All paid pledges by this email
  const paidPledges = await prisma.pledge.findMany({
    where: { email, status: PaymentStatus.PAID },
  })

  for (const pledge of paidPledges) {
    // 2) Ensure ACTIVE subscription for this user+animal
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

    // 3) Ensure a Payment record exists for this pledge/providerRef
    const providerRef = pledge.providerId ?? 'unknown'
    const already = await prisma.payment.findFirst({
      where: { subscriptionId: sub.id, providerRef },
    })
    if (!already) {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          provider: PaymentProvider.STRIPE,
          providerRef,
          amount: pledge.amount,
          currency: 'CZK',
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      })
    }

    // 4) OPTIONAL: If you later add `userId` to Pledge, you can link it:
    // await prisma.pledge.update({ where: { id: pledge.id }, data: { userId } })
  }
}