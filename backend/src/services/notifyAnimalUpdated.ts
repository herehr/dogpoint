// backend/src/services/notifyAnimalUpdated.ts
import { prisma } from '../prisma'
import { sendEmail as defaultSendEmail } from './email'

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: (to: string, subject: string, html: string) => Promise<any>
}

export async function notifyAnimalUpdated(animalId: string, opts: Opts = {}) {
  // recipients = users with ACTIVE subscriptions to this animal
  const subs = await prisma.subscription.findMany({
    where: {
      animalId,
      status: 'ACTIVE' as any,
    },
    select: {
      userId: true,
      user: { select: { email: true } },
      animal: { select: { jmeno: true, name: true } },
    } as any,
  })

  const animalName = subs[0]?.animal?.jmeno || subs[0]?.animal?.name || 'zvíře'

  // Create in-app notifications
  if (subs.length) {
    await prisma.notification.createMany({
      data: subs.map((s) => ({
        userId: s.userId,
        type: 'ANIMAL_UPDATED',
        title: 'Novinka u vašeho zvířete 🐾',
        message: `Byly upraveny informace u "${animalName}".`,
        animalId,
      })) as any,
      skipDuplicates: true as any, // if your Prisma version supports it for this model
    } as any)
  }

  // Optional emails
  if (opts.sendEmail) {
    const send = opts.sendEmailFn ?? defaultSendEmail
    const subject = 'Dogpoint – novinka u vašeho zvířete'
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4">
        <h2 style="margin:0 0 12px 0">Novinka u vašeho zvířete 🐾</h2>
        <p style="margin:0 0 8px 0">Byly upraveny informace u "${animalName}".</p>
        <p style="margin:0">Děkujeme,<br/>Dogpoint</p>
      </div>
    `
    for (const s of subs) {
      const email = (s as any).user?.email
      if (email) {
        try {
          await send(email, subject, html)
        } catch {
          // never break
        }
      }
    }
  }

  return { recipients: subs.length }
}