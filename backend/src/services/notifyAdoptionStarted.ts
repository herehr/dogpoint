// backend/src/services/notifyAdoptionStarted.ts
import { prisma } from '../prisma'
import { sendEmail as defaultSendEmail } from './email'

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: (to: string, subject: string, html: string) => Promise<any>
}

export async function notifyAdoptionStarted(
  userId: string,
  animalId: string,
  opts: Opts = {}
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const animal = await prisma.animal.findUnique({ where: { id: animalId } })

  const animalName = (animal as any)?.jmeno || (animal as any)?.name || 'zvíře'
  const title = 'Děkujeme za adopci! ❤️'
  const message = `Vaše adopce pro "${animalName}" byla úspěšně spuštěna.`

  // ✅ Idempotent: don’t create duplicates
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      animalId,
      type: 'ADOPTION_STARTED' as any,
    } as any,
    select: { id: true },
  })

  if (!existing) {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        animalId,
        type: 'ADOPTION_STARTED' as any,
      } as any,
    })
  }

  if (opts.sendEmail && user?.email) {
    const send = opts.sendEmailFn ?? defaultSendEmail
    const subject = 'Dogpoint – adopce byla spuštěna'
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4">
        <h2 style="margin:0 0 12px 0">${title}</h2>
        <p style="margin:0 0 8px 0">${message}</p>
        <p style="margin:0">Děkujeme,<br/>Dogpoint</p>
      </div>
    `
    await send(user.email, subject, html)
  }
}