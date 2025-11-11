import { prisma } from '../prisma'
import { PaymentProvider, SubscriptionStatus, PaymentStatus } from '@prisma/client'

/**
 * Link pledges (PAID or recent PENDING) to the user and grant immediate access.
 * Call this after successful login, first-time password, and register-after-payment.
 */
export async function linkPaidOrRecentPledgesToUser(userId: string, email: string) {
  // Allow recent PENDING pledges to unlock access for a while (webhook will confirm later)
  const PROVISIONAL_MINUTES = 180; // 3h
  const cutoff = new Date(Date.now() - PROVISIONAL_MINUTES * 60 * 1000);

  const pledges = await prisma.pledge.findMany({
    where: {
      email,
      OR: [
        { status: PaymentStatus.PAID },
        { status: PaymentStatus.PENDING, createdAt: { gte: cutoff } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const pl of pledges) {
    // 1) Ensure ACTIVE subscription exists for this user+animal
    const sub = await prisma.subscription.upsert({
      where: {
        userId_animalId_status: {
          userId,
          animalId: pl.animalId,
          status: SubscriptionStatus.ACTIVE,
        },
      },
      update: {},
      create: {
        userId,
        animalId: pl.animalId,
        monthlyAmount: pl.amount,
        currency: 'CZK',
        provider: PaymentProvider.STRIPE,
        providerRef: pl.providerId ?? undefined,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    // 2) If the pledge is already PAID, record a Payment once (no composite unique available)
    if (pl.status === PaymentStatus.PAID) {
      const existing = await prisma.payment.findFirst({
        where: {
          subscriptionId: sub.id,
          providerRef: pl.providerId ?? 'unknown',
        },
      });

      if (!existing) {
        await prisma.payment.create({
          data: {
            subscriptionId: sub.id,
            provider: PaymentProvider.STRIPE,
            providerRef: pl.providerId ?? 'unknown',
            amount: pl.amount,
            currency: 'CZK',
            status: PaymentStatus.PAID,
            paidAt: new Date(),
          },
        });
      }
    }

    // 3) If you later add Pledge.userId to the schema, you can link here.
    // For now we *don’t* write userId as it doesn’t exist in your schema.
    // Optionally, add an audit note:
    // await prisma.pledge.update({ where: { id: pl.id }, data: { note: 'linked to user ' + userId } }).catch(() => {});
  }
}