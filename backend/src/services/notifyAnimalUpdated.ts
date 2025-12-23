// backend/src/services/notifyAnimalUpdated.ts
import { prisma } from '../prisma'

/**
 * Notify all ACTIVE adopters that an animal was updated.
 * Idempotent: max one notification per user per day.
 */
export async function notifyAnimalUpdated(animalId: string): Promise<{ notified: number }> {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { jmeno: true, name: true } as any,
  })

  if (!animal) return { notified: 0 }

  const animalName = (animal as any)?.jmeno || (animal as any)?.name || 'zvíře'

  const subs = await prisma.subscription.findMany({
    where: {
      animalId,
      status: 'ACTIVE' as any,
    } as any,
    select: { userId: true },
  })

  if (!subs.length) return { notified: 0 }

  const userIds = [...new Set(subs.map(s => s.userId))]
  const today = new Date().toISOString().slice(0, 10)

  let notified = 0

  for (const userId of userIds) {
    const exists = await prisma.notification.findFirst({
      where: {
        userId,
        animalId,
        type: 'ANIMAL_UPDATED' as any,
        createdAt: {
          gte: new Date(`${today}T00:00:00.000Z`),
          lt: new Date(`${today}T23:59:59.999Z`),
        },
      } as any,
      select: { id: true },
    })

    if (exists) continue

    await prisma.notification.create({
      data: {
        userId,
        type: 'ANIMAL_UPDATED' as any,
        title: `Aktualizace profilu: ${animalName}`,
        message: 'Byly upraveny informace o zvířeti, které podporujete.',
        animalId,
      } as any,
    })

    notified++
  }

  return { notified }
}