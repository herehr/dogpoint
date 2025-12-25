// backend/src/services/notifyAdoption.ts
import { prisma } from '../prisma'
import { mailer } from './mailer'

function animalNameOf(animal: any) {
  return animal?.jmeno || animal?.name || 'zvíře'
}

export async function notifyAdoptionStarted(userId: string, animalId: string) {
  const [animal, user] = await Promise.all([
    prisma.animal.findUnique({
      where: { id: animalId },
      select: { jmeno: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  ])

  const animalName = animalNameOf(animal)

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

  // Email (best-effort)
  if (!user?.email) return
  try {
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
  } catch (e) {
    console.warn('[notifyAdoptionStarted] email failed', e)
  }
}

export async function notifyAdoptionCancelled(userId: string, animalId: string) {
  const [animal, user] = await Promise.all([
    prisma.animal.findUnique({
      where: { id: animalId },
      select: { jmeno: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  ])

  const animalName = animalNameOf(animal)

  // DB notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'ADOPTION_CANCELLED',
      title: 'Adopce byla zrušena',
      message: `Vaše adopce (${animalName}) byla zrušena.`,
      animalId,
    },
  })

  // Email (best-effort)
  if (!user?.email) return
  try {
    const subject = 'Dogpoint – adopce zrušena'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <p>Dobrý den,</p>
        <p>Vaše adopce <b>${animalName}</b> byla zrušena.</p>
        <p>Kdykoliv se k nám můžete vrátit.</p>
        <p>Dogpoint</p>
      </div>
    `
    await mailer.send({ to: user.email, subject, html })
  } catch (e) {
    console.warn('[notifyAdoptionCancelled] email failed', e)
  }
}