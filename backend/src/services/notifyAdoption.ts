// backend/src/services/notifyAdoption.ts
import { prisma } from '../prisma'
import { mailer } from './mailer'

export async function notifyAdoptionStarted(userId: string, animalId: string) {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { jmeno: true, name: true },
  })

  const animalName = animal?.jmeno || animal?.name || 'zvíře'

  // DB notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'ADOPTION_STARTED',
      title: 'Děkujeme za adopci ❤️',
      message: `Vaše adopce (${animalName}) byla úspěšně zahájena.`,
      animalId,
    },
  })

  // Email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user?.email) return

  const subject = 'Dogpoint – adopce zahájena ❤️'
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <p>Dobrý den,</p>
      <p>děkujeme! Vaše adopce <b>${animalName}</b> byla úspěšně zahájena.</p>
      <p>Od teď uvidíte fotky, videa a nové příspěvky.</p>
      <p>Děkujeme,<br/>Dogpoint</p>
    </div>
  `
  await mailer.send({ to: user.email, subject, html })
}