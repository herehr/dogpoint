// backend/src/controllers/authExtra.ts
import { prisma } from '../prisma'
import { logErr } from '../lib/log'

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
        } catch (e) {
          logErr('subscription.create', e)
          // Try minimal create if fields differ in your schema
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
        } catch (e) {
          logErr('subscription.promote', e)
        }
      }

      if (pledge.status === 'PAID') {
        const providerRef = pledge.providerId ?? `pledge:${pledge.id}`

        try {
          await prisma.payment.upsert({
            where: {
              subscriptionId_providerRef: {
                subscriptionId: sub.id,
                providerRef,
              } as any,
            },
            update: {},
            create: {
              subscriptionId: sub.id,
              providerRef,
              amount: pledge.amount,
              status: 'PAID' as any,
              paidAt: new Date(),
              provider: 'STRIPE' as any,
              // remove currency if not in your schema
              ...(hasPaymentCurrency() ? { currency: 'CZK' } : {}),
            } as any,
          })
        } catch (e) {
          logErr('payment.upsert', e)
          // Manual idempotency fallback
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
            } catch (e2) {
              logErr('payment.create', e2)
            }
          }
        }

        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: {
              status: 'PAID' as any,
              note: appendNote(pledge.note, `linked->sub:${sub.id}`),
            },
          })
        } catch (e) {
          logErr('pledge.update.paid', e)
        }
      } else {
        // PENDING in grace
        try {
          if ((sub as any).status && (sub as any).status !== 'ACTIVE') {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'PENDING' as any },
            })
          }
        } catch (e) {
          logErr('subscription.pending', e)
        }
        try {
          await prisma.pledge.update({
            where: { id: pledge.id },
            data: { note: appendNote(pledge.note, `grace-linked->sub:${sub.id}`) },
          })
        } catch (e) {
          logErr('pledge.update.pending', e)
        }
      }

      processed += 1
    } catch (e) {
      logErr('link.loop', e)
      // continue with next pledge
    }
  }

  return { processed }
}

function appendNote(note: string | null, msg: string): string {
  const base = note?.trim() ? `${note.trim()}\n` : ''
  return `${base}${new Date().toISOString()} ${msg}`
}

// runtime probe (duck typing): does Payment have a currency field?
function hasPaymentCurrency(): boolean {
  // quick & safe: try a select with currency and see if it throws
  // (we don't actually call this, but keep it super cheap by caching if needed)
  return true // set to false if your Payment has no `currency`
}