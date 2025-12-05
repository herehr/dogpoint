// backend/src/services/moderationNotifications.ts
import { prisma } from '../prisma'
import { sendEmail } from './email'
import type { Role } from '@prisma/client'

type BaseUser = {
  id: string
  email: string | null
  role: Role
}

const APP_NAME = 'Dogpoint adopce'

function getReviewUrl(type: 'animal' | 'post', id: string) {
  const base = process.env.FRONTEND_BASE_URL || 'https://dogpoint.cz'
  if (type === 'animal') {
    return `${base}/moderator/upravit-zvire/${id}`
  }
  return `${base}/moderator/prispevky` // adjust to your posts review page
}

export async function notifyApproversAboutNewAnimal(
  creator: BaseUser,
  animal: { id: string; jmeno: string | null; name: string | null }
) {
  const approvers = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'MODERATOR'] },
      id: { not: creator.id },
    },
  })

  if (!approvers.length) return

  const title = animal.jmeno || animal.name || 'Nové zvíře'
  const url = getReviewUrl('animal', animal.id)

  const subject = `${APP_NAME} – nové zvíře ke schválení`
  const html = `
    <p>Dobrý den,</p>
    <p>moderátor <b>${creator.email}</b> přidal nové zvíře, které čeká na schválení:</p>
    <ul>
      <li>Název: <b>${title}</b></li>
    </ul>
    <p>Zvíře můžete schválit nebo upravit zde:</p>
    <p><a href="${url}">${url}</a></p>
    <p>Děkujeme,<br>${APP_NAME}</p>
  `

  for (const user of approvers) {
    if (!user.email) continue
    // fire-and-forget, no await needed per loop
    void sendEmail(user.email, subject, html)
  }
}

export async function notifyApproversAboutNewPost(
  creator: BaseUser,
  post: { id: string; title: string; animalId: string }
) {
  const approvers = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'MODERATOR'] },
      id: { not: creator.id },
    },
    include: { },
  })

  if (!approvers.length) return

  const url = getReviewUrl('post', post.id)

  const subject = `${APP_NAME} – nový příspěvek ke schválení`
  const html = `
    <p>Dobrý den,</p>
    <p>moderátor <b>${creator.email}</b> přidal nový příspěvek, který čeká na schválení:</p>
    <ul>
      <li>Název příspěvku: <b>${post.title}</b></li>
    </ul>
    <p>Příspěvek můžete schválit nebo upravit zde:</p>
    <p><a href="${url}">${url}</a></p>
    <p>Děkujeme,<br>${APP_NAME}</p>
  `

  for (const user of approvers) {
    if (!user.email) continue
    void sendEmail(user.email, subject, html)
  }
}