// backend/src/services/notifyNewPost.ts
import { prisma } from '../prisma'
import { ContentStatus, SubscriptionStatus } from '@prisma/client'
import { sendEmail } from './email'

export async function notifyUsersAboutNewPost(postId: string, sendEmails = true) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      animal: true,
    },
  })

  if (!post || post.status !== ContentStatus.PUBLISHED) {
    return { ok: false }
  }

  const animalName = post.animal?.jmeno || post.animal?.name || 'Zvíře'

  const subscriptions = await prisma.subscription.findMany({
    where: {
      animalId: post.animalId,
      status: SubscriptionStatus.ACTIVE,
      user: { email: { not: '' } },
    },
    include: {
      user: true,
    },
  })

  let created = 0
  let emailed = 0

  for (const sub of subscriptions) {
    try {
      await prisma.notification.create({
        data: {
          userId: sub.userId,
          type: 'NEW_POST',
          title: `Nový příspěvek: ${animalName}`,
          message: post.title,
          animalId: post.animalId,
          postId: post.id,
        },
      })
      created++

      if (sendEmails && sub.user.email) {
        const url = `${process.env.FRONTEND_BASE_URL}/zvire/${post.animalId}#posts`
        await sendEmail(
          sub.user.email,
          `Dogpoint – nový příspěvek (${animalName})`,
          `
          <p>Dobrý den,</p>
          <p>u vašeho adoptovaného zvířete <b>${animalName}</b> byl přidán nový příspěvek:</p>
          <p><b>${post.title}</b></p>
          <p><a href="${url}">Zobrazit příspěvek</a></p>
          <p>Děkujeme,<br/>Dogpoint</p>
        `
        )
        emailed++
      }
    } catch (e: any) {
      // ignore duplicates (unique constraint userId + postId)
      if (e.code !== 'P2002') {
        console.warn('Notification failed', e.message)
      }
    }
  }

  return { ok: true, created, emailed }
}