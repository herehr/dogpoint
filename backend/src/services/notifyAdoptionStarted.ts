// backend/src/services/notifyAdoptionStarted.ts
import { prisma } from '../prisma'
import { sendEmail } from './email'

type Args = {
  userId: string
  animalId: string
  monthlyAmount?: number | null
  provider?: string | null
}

export async function notifyAdoptionStarted(args: Args) {
  const { userId, animalId, monthlyAmount, provider } = args

  // Load user + animal for nicer text/email
  const [user, animal] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.animal.findUnique({ where: { id: animalId } }),
  ])

  const animalName = animal?.jmeno || animal?.name || 'zvíře'
  const amountText =
    typeof monthlyAmount === 'number' ? `${monthlyAmount} Kč / měsíc` : 'měsíční podpora'
  const providerText = provider ? ` (${provider})` : ''

  const title = 'Děkujeme za adopci! ❤️'
  const message = `Vaše adopce pro "${animalName}" byla úspěšně spuštěna: ${amountText}${providerText}.`

  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      // if your schema has these fields, keep them; if not, delete them
      animalId,
      type: 'ADOPTION_STARTED',
    } as any,
  })

  // Optional email (only if user has email and EMAIL_* env is configured)
  if (user?.email) {
    const subject = 'Dogpoint – adopce byla spuštěna'
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4">
        <h2 style="margin:0 0 12px 0">${title}</h2>
        <p style="margin:0 0 8px 0">${message}</p>
        <p style="margin:0">Děkujeme,<br/>Dogpoint</p>
      </div>
    `
    await sendEmail(user.email, subject, html)
  }
}