// backend/src/services/moderationNotifications.ts
import { prisma } from '../prisma'
import { Role } from '@prisma/client'
import { sendEmailSafe } from './email'

const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.FRONTEND_BASE_URL ||
  'https://patron.dog-point.cz'
).replace(/\/+$/, '')

async function sendModerationEmails(
  subject: string,
  htmlBody: string,
  textBody: string,
  recipientEmails: string[],
): Promise<void> {
  if (!recipientEmails.length) return

  for (const to of recipientEmails) {
    await sendEmailSafe({ to, subject, html: htmlBody, text: textBody })
  }
}

/**
 * Notify all approvers (admins + other moderators) about a new animal
 * that is pending review.
 */
export async function notifyApproversAboutNewAnimal(
  animalId: string,
  name: string,
  createdById: string,
): Promise<void> {
  // Find all admins and moderators except the creator
  const approvers = await prisma.user.findMany({
    where: {
      role: { in: [Role.ADMIN, Role.MODERATOR] },
      id: { not: createdById },
    },
  })

  if (!approvers.length) return

  // NOTE: this URL assumes you will handle the animal ID on the frontend.
  // For now it points to a generic moderator animal view.
  const link = `${APP_BASE_URL}/moderator/animals?tab=pending`

  // Create in-app notifications
  await prisma.notification.createMany({
    data: approvers.map((u) => ({
      userId: u.id,
      type: 'ANIMAL_PENDING_REVIEW',
      title: 'Nové zvíře čeká na schválení',
      message: `Zvíře "${name}" čeká na schválení. Otevřete: ${link}`,
    })),
  })

  const emails = approvers.map((u) => u.email)
  const subject = 'Dogpoint – nové zvíře čeká na schválení'
  const textBody = `Dobrý den,

moderátor přidal nové zvíře, které čeká na schválení:

Zvíře: ${name}
Odkaz: ${link}

Stačí jedno schválení (admin nebo moderátor).

Děkujeme,
Dogpoint`
  const htmlBody = `
    <p>Dobrý den,</p>
    <p>Moderátor přidal nové zvíře, které čeká na schválení:</p>
    <p><strong>Zvíře:</strong> ${name}</p>
    <p><strong>Odkaz:</strong> <a href="${link}">${link}</a></p>
    <p>Stačí jedno schválení (admin nebo moderátor).</p>
    <p>Děkujeme,<br/>Dogpoint</p>
  `

  await sendModerationEmails(subject, htmlBody, textBody, emails)
}

/**
 * Notify all approvers (admins + other moderators) about a new post
 * that is pending review.
 */
export async function notifyApproversAboutNewPost(
  postId: string,
  title: string,
  animalName: string | null,
  createdById: string,
): Promise<void> {
  const approvers = await prisma.user.findMany({
    where: {
      role: { in: [Role.ADMIN, Role.MODERATOR] },
      id: { not: createdById },
    },
  })

  if (!approvers.length) return

  // Again, generic pending-posts view – you can later make
  // a /moderator/post/:id route and include postId in the URL.
  const link = `${APP_BASE_URL}/moderator/posts?tab=pending`

  await prisma.notification.createMany({
    data: approvers.map((u) => ({
      userId: u.id,
      type: 'POST_PENDING_REVIEW',
      title: 'Nový příspěvek čeká na schválení',
      message: `Příspěvek "${title}" (${animalName ?? 'bez zvířete'}) čeká na schválení. Otevřete: ${link}`,
    })),
  })

  const emails = approvers.map((u) => u.email)
  const subject = 'Dogpoint – nový příspěvek čeká na schválení'
  const textBody = `Dobrý den,

moderátor přidal nový příspěvek, který čeká na schválení:

Nadpis: ${title}
Zvíře: ${animalName ?? 'bez zvířete'}
Odkaz: ${link}

Stačí jedno schválení (admin nebo moderátor).

Děkujeme,
Dogpoint`
  const htmlBody = `
    <p>Dobrý den,</p>
    <p>Moderátor přidal nový příspěvek, který čeká na schválení:</p>
    <p><strong>Nadpis:</strong> ${title}</p>
    <p><strong>Zvíře:</strong> ${animalName ?? 'bez zvířete'}</p>
    <p><strong>Odkaz:</strong> <a href="${link}">${link}</a></p>
    <p>Stačí jedno schválení (admin nebo moderátor).</p>
    <p>Děkujeme,<br/>Dogpoint</p>
  `

  await sendModerationEmails(subject, htmlBody, textBody, emails)
}