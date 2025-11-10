// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'

/**
 * Link pledges (by email) to a user:
 * - PAID pledges => ensure Subscription(userId+animalId), create Payment once (idempotent)
 * - recent PENDING pledges (grace window) => ensure Subscription so UI can unblur after redirect
 *
 * Returns number of pledges processed.
 */
export async function linkPaidOrRecentPledgesToUser(
  userId: string,
  email: string,
  opts?: {
    graceMinutes?: number // treat PENDING as provisional for this long
    now?: Date
  }
): Promise<{ processed: number }> {
  const graceMinutes = opts?.graceMinutes ?? 30
  const now = opts?.now ?? new Date()
  const graceSince = new Date(now.getTime() - graceMinutes * 60_000)

  // 1) Relevant pledges for this email
  const pledges = await prisma.pledge.findMany({
    where: {
      email,
      OR: [
        { status: 'PAID' },
        { status: 'PENDING', createdAt: { gte: graceSince } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  let processed = 0

  for (const pledge of pledges) {
    // 2) Ensure subscription (NO amount/interval here)
    let sub = await prisma.subscription.findFirst({
      where: {
        userId,
        animalId: pledge.animalId,
      },
    })

    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          userId,
          animalId: pledge.animalId,
          // If your schema has no `status`, remove the next line.
          status: pledge.status === 'PAID' ? ('ACTIVE' as any) : ('PENDING' as any),
          // If your schema has no `startedAt`, remove the next line.
          startedAt: new Date() as any,
        } as any,
      })
    } else {
      // promote to ACTIVE if we have a paid pledge
      if (pledge.status === 'PAID' && (sub as any).status !== 'ACTIVE') {
        try {
          sub = await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'ACTIVE' as any },
          })
        } catch {
          // If your schema has no status, ignore
        }
      }
    }

    // 3) If PAID → create Payment once (idempotent)
    if (pledge.status === 'PAID') {
      const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

      // Prefer composite unique upsert; fallback to manual
      try {
        await prisma.payment.upsert({
          where: {
            // requires @@unique([subscriptionId, providerRef]) in schema
            subscriptionId_providerRef: {
              subscriptionId: sub.id,
              providerRef,
            } as any,
          },
          update: {}, // idempotent
          create: {
            subscriptionId: sub.id,
            providerRef,
            amount: pledge.amount,      // allowed in your schema
            currency: 'CZK',            // keep if your schema has currency
            status: 'PAID' as any,
            paidAt: new Date(),
            provider: 'STRIPE' as any,  // REQUIRED by your schema
          },
        })
      } catch {
        // No composite unique? Do manual idempotency
        const existing = await prisma.payment.findFirst({
          where: { subscriptionId: sub.id, providerRef },
        })
        if (!existing) {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              providerRef,
              amount: pledge.amount,
              currency: 'CZK',
              status: 'PAID' as any,
              paidAt: new Date(),
              provider: 'STRIPE' as any,
            },
          })
        }
      }

      // annotate pledge (do NOT set pledge.userId — that field doesn’t exist)
      await prisma.pledge.update({
        where: { id: pledge.id },
        data: {
          status: 'PAID',
          note: appendNote(pledge.note, `linked->sub:${sub.id}`),
        },
      })
    } else {
      // PENDING (within grace) → ensure sub is PENDING
      try {
        // If your schema has no status, this will throw — that's fine.
        if ((sub as any).status !== 'ACTIVE') {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'PENDING' as any },
          })
        }
      } catch {
        /* ignore if no status field */
      }

      await prisma.pledge.update({
        where: { id: pledge.id },
        data: {
          note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`),
        },
      })
    }

    processed += 1
  }

  return { processed }
}

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}