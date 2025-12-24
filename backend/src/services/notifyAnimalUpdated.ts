// backend/src/services/notifyAnimalUpdated.ts
import { prisma } from '../prisma'
import { sendEmail as defaultSendEmail } from './email'

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: (to: string, subject: string, html: string) => Promise<any>
}

export async function notifyAnimalUpdated(animalId: string, opts: Opts = {}) {
  // IMPORTANT: do NOT use select { jmeno, name } because your Prisma schema may not have them.
  const animal = (await (prisma as any).animal.findUnique({
    where: { id: animalId },
  })) as any

  const animalName =
    animal?.jmeno ||
    animal?.name ||
    animal?.title ||
    animal?.nazev ||
    'zvíře'

  // recipients = users with ACTIVE subscriptions to this animal
  const subs = (await (prisma as any).subscription.findMany({
    where: { animalId, status: 'ACTIVE' },
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  })) as Array<{ userId: string; user?: { email?: string | null } }>

  const title = 'Novinka u vašeho zvířete 🐾'
  const message = `Byly upraveny informace u "${animalName}".`

  if (!subs?.length) {
    console.log('[notifyAnimalUpdated] no recipients', { animalId })
    return { recipients: 0 }
  }

  // create in-app notifications (best-effort; must never break updates)
  for (const s of subs) {
    try {
      await (prisma as any).notification.create({
        data: {
          userId: s.userId,
          type: 'ANIMAL_UPDATED',
          title,
          message,
          animalId,
          postId: null,
        },
      })
    } catch (e) {
      console.warn('[notifyAnimalUpdated] notification create failed', e)
    }
  }

  // optional emails
  if (opts.sendEmail) {
    const send = opts.sendEmailFn ?? defaultSendEmail
    const subject = 'Dogpoint – novinka u vašeho zvířete'
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4">
        <h2 style="margin:0 0 12px 0">${title}</h2>
        <p style="margin:0 0 8px 0">${message}</p>
        <p style="margin:0">Děkujeme,<br/>Dogpoint</p>
      </div>
    `

    for (const s of subs) {
      const email = s?.user?.email
      if (!email) continue
      try {
        await send(email, subject, html)
      } catch (e) {
        console.warn('[notifyAnimalUpdated] email failed', e)
      }
    }
  }

  return { recipients: subs.length }
}