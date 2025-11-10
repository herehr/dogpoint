// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'

/**
 * Link pledges (by email) to a user:
 * - PAID pledges => ensure Subscription(userId+animalId), create Payment (idempotent)
 * - recent PENDING pledges (grace) => ensure Subscription so UI can unblur after redirect
 */
export async function linkPaidOrRecentPledgesToUser(
  userId: string,
  email: string,
  opts?: { graceMinutes?: number; now?: Date }
): Promise<{ processed: number }> {
  const graceMinutes = opts?.graceMinutes ?? 30
  const now = opts?.now ?? new Date()
  const graceSince = new Date(now.getTime() - graceMinutes * 60_000)

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
    if (!pledge.animalId) continue

    // 1) Ensure subscription (schema-tolerant)
    let sub = await prisma.subscription.findFirst({
      where: { userId, animalId: pledge.animalId },
    })

    if (!sub) {
      try {
        sub = await prisma.subscription.create({
          data: {
            userId,
            animalId: pledge.animalId,
            ...(fieldExists('subscription', 'status')
              ? { status: pledge.status === 'PAID' ? ('ACTIVE' as any) : ('PENDING' as any) }
              : {}),
            ...(fieldExists('subscription', 'startedAt')
              ? { startedAt: new Date() as any }
              : {}),
          } as any,
        })
      } catch {
        // Minimal shape if above fields don't exist
        sub = await prisma.subscription.create({
          data: { userId, animalId: pledge.animalId } as any,
        })
      }
    } else if (pledge.status === 'PAID' && (sub as any).status && (sub as any).status !== 'ACTIVE') {
      try {
        sub = await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE' as any },
        })
      } catch {
        // ignore if schema has no status
      }
    }

    // 2) Payments (only for PAID pledges), manual idempotency (no composite unique needed)
    if (pledge.status === 'PAID') {
      const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

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
            ...(fieldExists('payment', 'currency') ? { currency: 'CZK' } : {}),
          } as any,
        })
      }

      try {
        await prisma.pledge.update({
          where: { id: pledge.id },
          data: {
            status: 'PAID' as any,
            note: appendNote(pledge.note, `linked->sub:${sub.id}`),
          },
        })
      } catch {
        // ignore
      }
    } else {
      // PENDING within grace → keep/create sub and annotate
      try {
        if ((sub as any).status && (sub as any).status !== 'ACTIVE') {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'PENDING' as any },
          })
        }
      } catch {
        // ignore
      }
      try {
        await prisma.pledge.update({
          where: { id: pledge.id },
          data: { note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`) },
        })
      } catch {
        // ignore
      }
    }

    processed += 1
  }

  return { processed }
}

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}

// Tiny probe toggles — set to true only if your schema actually has those columns.
function fieldExists(model: 'payment' | 'subscription', column: string): boolean {
  if (model === 'payment' && column === 'currency') return true
  if (model === 'subscription' && column === 'status') return true
  if (model === 'subscription' && column === 'startedAt') return true
  return false
}