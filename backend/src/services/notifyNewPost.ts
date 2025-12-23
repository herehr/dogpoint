// backend/src/services/notifyNewPost.ts
import { prisma } from '../prisma'
import { sendEmail as defaultSendEmail } from './email'

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: (to: string, subject: string, html: string) => Promise<any>
}

/**
 * Notify all ACTIVE adopters of an animal that a post was published/approved.
 * Idempotent: won't create duplicates for same (userId, postId, type).
 */
export async function notifyUsersAboutNewPost(
  postId: string,
  opts: Opts = {}
): Promise<{ notified: number }> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      animalId: true,
      status: true,
    } as any,
  })

  if (!post?.animalId) return { notified: 0 }

  // Only notify for published/approved posts (adjust if your enum differs)
  const status = String((post as any).status || '')
  const okStatus = status === 'PUBLISHED' || status === 'APPROVED'
  if (!okStatus) return { notified: 0 }

  // All active adopters for this animal
  const subs = await prisma.subscription.findMany({
    where: {
      animalId: post.animalId,
      status: 'ACTIVE' as any,
    } as any,
    select: { userId: true },
  })

  if (!subs.length) return { notified: 0 }

  const userIds = [...new Set(subs.map(s => s.userId))]

  const animal = await prisma.animal.findUnique({
    where: { id: post.animalId },
    select: { jmeno: true, name: true } as any,
  })
  const animalName = (animal as any)?.jmeno || (animal as any)?.name || 'zvíře'

  const title = `Novinka o ${animalName}`
  const excerpt =
    (post.content || '')
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 180) || 'Byla zveřejněna nová aktualita.'

  // Load users (for email + creating notifications)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  })

  let notified = 0

  for (const u of users) {
    // ✅ idempotency: same user + same post + same type
    const exists = await prisma.notification.findFirst({
      where: {
        userId: u.id,
        postId: post.id,
        type: 'NEW_POST' as any,
      } as any,
      select: { id: true },
    })

    if (exists) continue

    await prisma.notification.create({
      data: {
        userId: u.id,
        type: 'NEW_POST' as any,
        title,
        message: excerpt,
        animalId: post.animalId,
        postId: post.id,
      } as any,
    })

    notified++

    if (opts.sendEmail && u.email) {
      try {
        const send = opts.sendEmailFn ?? defaultSendEmail
        const subject = `Dogpoint – ${title}`
        const html = `
          <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4">
            <h2 style="margin:0 0 12px 0">${title}</h2>
            <p style="margin:0 0 8px 0">${excerpt}</p>
            <p style="margin:0">Děkujeme,<br/>Dogpoint</p>
          </div>
        `
        await send(u.email, subject, html)
      } catch (e) {
        console.warn('[notifyUsersAboutNewPost] email failed', e)
      }
    }
  }

  return { notified }
}