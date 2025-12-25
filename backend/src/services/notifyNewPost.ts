// backend/src/services/notifyNewPost.ts
import { prisma } from '../prisma'
import { emailLayout } from './emailTemplates'
import { sendEmailSafe } from './email'

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: (to: string, subject: string, html: string, text?: string) => Promise<void>
}

function appBase(): string {
  return (process.env.APP_BASE_URL || 'https://patron.dog-point.cz').replace(/\/+$/, '')
}

export async function notifyUsersAboutNewPost(postId: string, opts: Opts = {}) {
  const sendEmail = opts.sendEmail === true
  const sendFn = opts.sendEmailFn || sendEmailSafe

  // 1) load post + animalId
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      animal: { select: { id: true, jmeno: true, name: true } },
      media: true,
    },
  })
  if (!post) return { ok: false, reason: 'post_not_found' as const }

  // IMPORTANT: only notify if actually published
  const status = String((post as any).status || '')
  if (status !== 'PUBLISHED') {
    return { ok: false, reason: 'not_published' as const, status }
  }

  const animalId = post.animalId
  if (!animalId) return { ok: false, reason: 'missing_animalId' as const }

  // 2) find active subscriptions to this animal
  const subs = await prisma.subscription.findMany({
    where: {
      animalId,
      status: { in: ['ACTIVE'] as any },
    },
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  })

  const recipients = subs
    .map((s) => s.user?.email?.trim().toLowerCase())
    .filter((e): e is string => !!e)

  // 3) create Notification rows (dedupe per user+post)
  const title = 'Nový příspěvek'
  const animalName = post.animal?.jmeno || post.animal?.name || 'Zvíře'
  const link = `${appBase()}/zvirata/${animalId}#posts`

  let created = 0
  for (const s of subs) {
    try {
      // idempotency: one notification per user+post
      const existing = await prisma.notification.findFirst({
        where: { userId: s.userId, postId: post.id },
        select: { id: true },
      })
      if (existing) continue

      await prisma.notification.create({
        data: {
          userId: s.userId,
          postId: post.id,
          title,
          body: `${post.title || 'Nový příspěvek'} – ${animalName}`,
          url: link,
          readAt: null,
        } as any,
      })
      created += 1
    } catch (e) {
      console.warn('[notifyUsersAboutNewPost] notification create failed', e)
    }
  }

  // 4) optionally email adopters
  let emailed = 0
  if (sendEmail && recipients.length) {
    const subject = `Dogpoint – nový příspěvek (${animalName})`

    const intro =
      `Dobrý den,<br />` +
      `u vašeho adoptovaného zvířete byl právě publikován nový příspěvek.`

    const bodyHtml =
      `<p style="margin:0 0 10px;"><strong>${escapeHtml(post.title || 'Nový příspěvek')}</strong></p>` +
      (post.body ? `<div style="margin:0 0 10px;">${post.body}</div>` : '')

    const { html } = emailLayout({
      title: 'Nový příspěvek',
      intro,
      bodyHtml,
      buttonText: 'Zobrazit příspěvek',
      buttonUrl: link,
      footerNote: 'Klikněte a zobrazte si nový příspěvek.',
    })

    for (const to of recipients) {
      try {
        await sendFn(to, subject, html)
        emailed += 1
      } catch (e) {
        console.warn('[notifyUsersAboutNewPost] email failed', { to, err: (e as any)?.message || e })
      }
    }
  }

  return { ok: true, recipients: recipients.length, notificationsCreated: created, emailed }
}

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}