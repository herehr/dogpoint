// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}

// If your Payment model has no `currency`, flip this to false.
function hasPaymentCurrency(): boolean {
  return true
}

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
      OR: [{ status: 'PAID' as any }, { status: 'PENDING' as any, createdAt: { gte: graceSince } }],
    },
    orderBy: { createdAt: 'asc' },
  })

  let processed = 0

  for (const pledge of pledges) {
    try {
      if (!pledge.animalId) continue

      let sub = await prisma.subscription.findFirst({
        where: { userId, animalId: pledge.animalId },
      })

      if (!sub) {
        try {
          sub = await prisma.subscription.create({
            data: {
              userId,
              animalId: pledge.animalId,
              status: pledge.status === 'PAID' ? ('ACTIVE' as any) : ('PENDING' as any),
              startedAt: new Date() as any,
            } as any,
          })
        } catch {
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
        } catch { /* ignore */ }
      }

      if (pledge.status === 'PAID') {
        const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

        // Try to find existing payment for idempotency
        const existing = await prisma.payment.findFirst({
          where: { subscriptionId: sub.id, providerRef },
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
                provider: 'STRIPE' as any,
                ...(hasPaymentCurrency() ? { currency: 'CZK' } : {}),
              } as any,
            })
          } catch { /* ignore */ }
        }

        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: {
              status: 'PAID' as any,
              note: appendNote(pledge.note, `linked->sub:${sub.id}`),
            },
          })
        } catch { /* ignore */ }
      } else {
        // PENDING in grace
        try {
          if ((sub as any).status && (sub as any).status !== 'ACTIVE') {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'PENDING' as any },
            })
          }
        } catch { /* ignore */ }
        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: { note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`) },
          })
        } catch { /* ignore */ }
      }

      processed += 1
    } catch {
      // continue
    }
  }

  return { processed }
}