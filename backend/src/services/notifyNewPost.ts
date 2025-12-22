// backend/src/services/notifyNewPost.ts
import { prisma } from '../prisma'
import { ContentStatus, SubscriptionStatus } from '@prisma/client'
import { sendEmail } from './email'

function frontendBase(): string {
  return (process.env.FRONTEND_BASE_URL || process.env.PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '')
}

export async function notifyUsersAboutNewPost(postId: string, sendEmails = true) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      status: true,
      animalId: true,
      animal: { select: { jmeno: true, name: true } },
    },
  })

  if (!post || post.status !== ContentStatus.PUBLISHED) {
    return { ok: false as const, created: 0, emailed: 0 }
  }

  const animalName = post.animal?.jmeno || post.animal?.name || 'Zvíře'

  const subs = await prisma.subscription.findMany({
    where: {
      animalId: post.animalId,
      status: SubscriptionStatus.ACTIVE,
      user: {
        is: {
          email: { not: '' },
        },
      },
    },
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  })

  let created = 0
  let emailed = 0

  const base = frontendBase()
  const url = base ? `${base}/zvire/${post.animalId}#posts` : ''

  for (const s of subs) {
    const email = s.user?.email || ''

    try {
      await prisma.notification.create({
        data: {
          userId: s.userId,
          type: 'NEW_POST',
          title: `Nový příspěvek: ${animalName}`,
          message: post.title || 'Byl přidán nový příspěvek.',
          animalId: post.animalId,
          postId: post.id,
        },
      })
      created++

      if (sendEmails && email) {
        await sendEmail(
          email,
          `Dogpoint – nový příspěvek (${animalName})`,
          `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <p>Dobrý den,</p>
              <p>u vašeho adoptovaného zvířete <b>${animalName}</b> byl přidán nový příspěvek:</p>
              <p><b>${escapeHtml(post.title || '')}</b></p>
              ${url ? `<p><a href="${url}">Zobrazit příspěvek</a></p>` : ''}
              <p>Děkujeme,<br/>Dogpoint</p>
            </div>
          `
        )
        emailed++
      }
    } catch (e: any) {
      // ignore duplicates (unique constraint userId + postId)
      if (e?.code !== 'P2002') {
        console.warn('[notifyUsersAboutNewPost] create/send failed:', e?.message || e)
      }
    }
  }

  return { ok: true as const, created, emailed }
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}