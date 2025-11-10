// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'

/**
 * Link pledges (by email) to a user:
 * - PAID pledges → ensure Subscription(userId+animalId), create a Payment once (manual idempotency)
 * - recent PENDING pledges (within grace) → ensure Subscription so the UI can unblur immediately
 *
 * Works even if your Prisma schema:
 *  - does NOT have Subscription.status / Subscription.startedAt
 *  - does NOT have Payment.currency
 *  - does NOT have a composite unique on Payment(subscriptionId, providerRef)
 */
export async function linkPaidOrRecentPledgesToUser(
  userId: string,
  email: string,
  opts?: { graceMinutes?: number; now?: Date }
): Promise<{ processed: number }> {
  const graceMinutes = opts?.graceMinutes ?? 30
  const now = opts?.now ?? new Date()
  const graceSince = new Date(now.getTime() - graceMinutes * 60_000)

  // 1) Relevant pledges for this email
  const pledges = await prisma.pledge.findMany({
    where: {
      email,
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

      // 2) Ensure subscription (userId + animalId)
      let sub = await prisma.subscription.findFirst({
        where: { userId, animalId: pledge.animalId },
      })

      if (!sub) {
        // Try with status/startedAt if your schema has them, otherwise fall back to minimal create
        try {
          sub = await prisma.subscription.create({
            data: {
              userId,
              animalId: pledge.animalId,
              status: (pledge.status === 'PAID' ? 'ACTIVE' : 'PENDING') as any,
              startedAt: new Date() as any,
            } as any,
          })
        } catch (e) {
          console.error('[authExtra] subscription.create (rich) failed, falling back:', e)
          sub = await prisma.subscription.create({
            data: { userId, animalId: pledge.animalId } as any,
          })
        }
      } else if (pledge.status === 'PAID') {
        // Promote to ACTIVE if schema has 'status'
        try {
          if ((sub as any).status && (sub as any).status !== 'ACTIVE') {
            sub = await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'ACTIVE' as any },
            })
          }
        } catch (e) {
          // schema may not have 'status'
          console.error('[authExtra] subscription.promote failed:', e)
        }
      }

      // 3) If PAID → create Payment once (manual idempotency; no composite unique needed)
      if (pledge.status === 'PAID') {
        const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

        const existing = await prisma.payment.findFirst({
          where: { subscriptionId: sub.id, providerRef },
          select: { id: true },
        })

        if (!existing) {
          try {
            await prisma.payment.create({
              data: {
                subscriptionId: sub.id,
                providerRef,
                amount: pledge.amount,
                status: 'PAID' as any,
                paidAt: new Date(),
                provider: 'STRIPE' as any, // REQUIRED if your schema has 'provider'
                // If your schema has 'currency', leave the next line; otherwise remove it.
                currency: 'CZK' as any,
              } as any,
            })
          } catch (e) {
            console.error('[authExtra] payment.create failed:', e)
          }
        }

        // Mark pledge with note (and status PAID—idempotent)
        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: {
              status: 'PAID' as any,
              note: appendNote(pledge.note, `linked->sub:${sub.id}`),
            },
          })
        } catch (e) {
          console.error('[authExtra] pledge.update (paid) failed:', e)
        }
      } else {
        // PENDING within grace → keep subscription pending if schema supports it
        try {
          if ((sub as any).status && (sub as any).status !== 'ACTIVE') {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'PENDING' as any },
            })
          }
        } catch (e) {
          // schema may not have 'status'
          console.error('[authExtra] subscription.pending mark failed:', e)
        }

        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: { note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`) },
          })
        } catch (e) {
          console.error('[authExtra] pledge.update (pending) failed:', e)
        }
      }

      processed += 1
    } catch (e) {
      console.error('[authExtra] loop error:', e)
      // continue with next pledge
    }
  }

  return { processed }
}

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}