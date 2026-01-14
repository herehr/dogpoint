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

  const animalName =
    (animal as any)?.jmeno ||
    (animal as any)?.name ||
    (animal as any)?.title ||
    'zvíře'

  // CLIENT REQUESTED TEXT
  const title = 'Děkujeme ti za adopci na dálku ❤️'
  const message = `${animalName} ti moc děkuje za podporu a těší se na společné novinky.`

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

  // Optional welcome e-mail
  if (opts.sendEmail && user?.email) {
    const send = opts.sendEmailFn ?? defaultSendEmail

    const subject = 'Děkujeme ti za adopci na dálku ❤️'

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">
        <p style="margin:0 0 12px 0;">
          Vítej v klubu, náš nový patrone.
        </p>

        <p style="margin:0 0 12px 0;">
          <strong>${animalName}</strong> ti moc děkuje za podporu
          a těší se, až s tebou bude sdílet novinky
          ze svého útulkového života.
        </p>

        <p style="margin:0 0 12px 0;">
          Vždy, když se u něj něco semele,
          přijde ti upozornění na mail.
        </p>

        <p style="margin:0 0 12px 0;">
          Jsme šťastní, že jsi s námi.<br/>
          Posíláme pac a pusu.
        </p>

        <p style="margin:0;">
          Tým z Dogpointu
        </p>
      </div>
    `

    await send(user.email, subject, html)
  }
}