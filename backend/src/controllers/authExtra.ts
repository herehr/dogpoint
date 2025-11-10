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

    // Ensure subscription (status tolerant)
    let sub = await prisma.subscription.findFirst({
      where: { userId, animalId: pledge.animalId },
    })

    if (!sub) {
      try {
        sub = await prisma.subscription.create({
          data: {
            userId,
            animalId: pledge.animalId,
            ...(fieldExists('subscription', 'status') ? { status: pledge.status === 'PAID' ? ('ACTIVE' as any) : ('PENDING' as any) } : {}),
            ...(fieldExists('subscription', 'startedAt') ? { startedAt: new Date() as any } : {}),
          } as any,
        })
      } catch {
        sub = await prisma.subscription.create({ data: { userId, animalId: pledge.animalId } as any })
      }
    } else if (pledge.status === 'PAID' && (sub as any).status && (sub as any).status !== 'ACTIVE') {
      try {
        sub = await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE' as any } })
      } catch {}
    }

    if (pledge.status === 'PAID') {
      const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

      // Try idempotent path; if your schema lacks the composite, fall back
      try {
        await prisma.payment.upsert({
          where: { /* @ts-expect-error: composite may not exist */ subscriptionId_providerRef: { subscriptionId: sub.id, providerRef } },
          update: {},
          create: {
            subscriptionId: sub.id,
            providerRef,
            amount: pledge.amount,
            status: 'PAID' as any,
            paidAt: new Date(),
            provider: 'STRIPE' as any,
            ...(fieldExists('payment', 'currency') ? { currency: 'CZK' } : {}),
          } as any,
        } as any)
      } catch {
        const existing = await prisma.payment.findFirst({ where: { subscriptionId: sub.id, providerRef } })
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
      }

      try {
        await prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: 'PAID' as any, note: appendNote(pledge.note, `linked->sub:${sub.id}`) },
        })
      } catch {}
    } else {
      try {
        if ((sub as any).status && (sub as any).status !== 'ACTIVE') {
          await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PENDING' as any } })
        }
      } catch {}
      try {
        await prisma.pledge.update({
          where: { id: pledge.id },
          data: { note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`) },
        })
      } catch {}
    }

    processed += 1
  }

  return { processed }
}

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}

// extremely small “probe” helpers (kept constant here)
function fieldExists(_model: 'payment' | 'subscription', _column: string): boolean {
  // set to true for columns you know exist; false otherwise
  if (_model === 'payment' && _column === 'currency') return true
  if (_model === 'subscription' && _column === 'status') return true
  if (_model === 'subscription' && _column === 'startedAt') return true
  return false
}