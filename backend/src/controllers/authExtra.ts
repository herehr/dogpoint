// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'
import { SubscriptionStatus } from '@prisma/client'
import { notifyAdoptionStarted } from '../services/notifyAdoptionStarted'
import { sendEmail } from '../services/email'

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}

// If your Payment model has no `currency`, flip this to false.
function hasPaymentCurrency(): boolean {
  return true
}

// Small helper to normalize email consistently
function normalizeEmail(e: string | null | undefined): string | null {
  const s = (e ?? '').trim().toLowerCase()
  return s || null
}

async function safeNotifyAdoptionStarted(userId: string, animalId: string) {
  try {
    await notifyAdoptionStarted(userId, animalId, {
      sendEmail: true,
      sendEmailFn: sendEmail,
    })
  } catch (e) {
    console.warn('[notifyAdoptionStarted] failed', e)
  }
}

/**
 * Link PAID or recent PENDING pledges for a given email to a user:
 * - Create / update Subscription(userId, animalId, ...)
 * - Create Payment rows for PAID pledges (idempotent per providerRef)
 * - Update pledge.status / pledge.note accordingly
 */
export async function linkPaidOrRecentPledgesToUser(
  userId: string,
  email: string,
  opts?: { graceMinutes?: number; now?: Date }
): Promise<{ processed: number }> {
  const graceMinutes = opts?.graceMinutes ?? 30
  const now = opts?.now ?? new Date()
  const graceSince = new Date(now.getTime() - graceMinutes * 60_000)

  const normEmail = normalizeEmail(email)
  if (!normEmail) return { processed: 0 }

  // 1) Load relevant pledges (PAID or recent PENDING) for this email
  const pledges = await prisma.pledge.findMany({
    where: {
      email: normEmail,
      OR: [
        { status: 'PAID' as any },
        { status: 'PENDING' as any, createdAt: { gte: graceSince } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  let processed = 0

  for (const pledge of pledges) {
    try {
      if (!pledge.animalId) continue

      // 2) Find or create subscription for this user+animal
      let sub = await prisma.subscription.findFirst({
        where: { userId, animalId: pledge.animalId },
      })

      const monthlyAmount = pledge.amount ?? 0
      const pledgeIsPaid = pledge.status === 'PAID'

      if (!sub) {
        // no subscription yet -> create one
        try {
          sub = await prisma.subscription.create({
            data: {
              userId,
              animalId: pledge.animalId,
              monthlyAmount: monthlyAmount as any,
              provider: 'STRIPE' as any,
              status: pledgeIsPaid ? ('ACTIVE' as any) : ('PENDING' as any),
              startedAt: new Date() as any,
              // interval removed (Subscription model has no interval field)
            } as any,
          })

          // ✅ If we created an ACTIVE subscription from a PAID pledge → notify now
          if (pledgeIsPaid) {
            await safeNotifyAdoptionStarted(userId, pledge.animalId)
          }
        } catch (err) {
          console.error(
            '[linkPaidOrRecentPledgesToUser] create subscription with pledge info failed, retrying minimal:',
            err
          )

          // Fallback: still include monthlyAmount + provider
          sub = await prisma.subscription.create({
            data: {
              userId,
              animalId: pledge.animalId,
              monthlyAmount: monthlyAmount as any,
              provider: 'STRIPE' as any, // required
            } as any,
          })

          // If fallback happened and pledge is PAID, we still want the notification.
          if (pledgeIsPaid) {
            await safeNotifyAdoptionStarted(userId, pledge.animalId)
          }
        }
      } else if (pledgeIsPaid && (sub as any).status && (sub as any).status !== 'ACTIVE') {
        // 3) If we already have a subscription but payment is now PAID → set ACTIVE
        //    BUT: never re-activate a user-canceled subscription.
        if ((sub as any).status === SubscriptionStatus.CANCELED || (sub as any).status === 'CANCELED') {
          console.log('[linkPaidOrRecentPledgesToUser] skip re-activating canceled subscription', sub.id)
        } else {
          try {
            sub = await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'ACTIVE' as any },
            })

            // ✅ We activated it now → notify
            await safeNotifyAdoptionStarted(userId, pledge.animalId)
          } catch (err) {
            console.error('[linkPaidOrRecentPledgesToUser] update subscription status failed:', err)
          }
        }
      }

      // 4) For PAID pledges, create a Payment row (idempotent per providerRef)
      if (pledgeIsPaid) {
        const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

        try {
          const existing = await prisma.payment.findFirst({
            where: { subscriptionId: sub.id, providerRef },
          })
          if (!existing) {
            await prisma.payment.create({
              data: {
                subscriptionId: sub.id,
                providerRef,
                amount: pledge.amount,
                status: 'PAID' as any,
                paidAt: new Date(),
                provider: 'STRIPE' as any,
                ...(hasPaymentCurrency() ? { currency: 'CZK' } : {}),
              } as any,
            })
          }
        } catch (err) {
          console.error('[linkPaidOrRecentPledgesToUser] create payment failed:', err)
        }

        // 5) Mark pledge as PAID and note that it was linked
        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: {
              status: 'PAID' as any,
              note: appendNote(pledge.note, `linked->sub:${sub.id}`),
              email: normEmail,
            },
          })
        } catch (err) {
          console.error('[linkPaidOrRecentPledgesToUser] update pledge (PAID) failed:', err)
        }
      } else {
        // PENDING within grace period
        try {
          const currentStatus = (sub as any).status
          if (
            currentStatus &&
            currentStatus !== 'ACTIVE' &&
            currentStatus !== SubscriptionStatus.CANCELED &&
            currentStatus !== 'CANCELED'
          ) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'PENDING' as any },
            })
          } else if (currentStatus === SubscriptionStatus.CANCELED || currentStatus === 'CANCELED') {
            console.log(
              '[linkPaidOrRecentPledgesToUser] skip updating status to PENDING for canceled subscription',
              sub.id
            )
          }
        } catch (err) {
          console.error('[linkPaidOrRecentPledgesToUser] update subscription (PENDING) failed:', err)
        }

        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: {
              note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`),
              email: normEmail,
            },
          })
        } catch (err) {
          console.error('[linkPaidOrRecentPledgesToUser] update pledge (PENDING) failed:', err)
        }
      }

      processed += 1
    } catch (err) {
      console.error('[linkPaidOrRecentPledgesToUser] pledge loop error:', err)
      // continue with next pledge
    }
  }

  return { processed }
}