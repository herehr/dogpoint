// backend/src/services/notifyNewPost.ts
import { prisma } from '../prisma'
import { renderDogpointEmailLayout } from './emailTemplates'

type SendEmailFn = (to: string, subject: string, html: string, text?: string) => Promise<void>

type NotifyOptions = {
  sendEmail?: boolean
  sendEmailFn?: SendEmailFn
}

function appBase(): string {
  return (process.env.APP_BASE_URL || 'https://patron.dog-point.cz').replace(/\/+$/, '')
}

export async function notifyUsersAboutNewPost(postId: string, opts: NotifyOptions = {}) {
  const sendEmail = Boolean(opts.sendEmail && opts.sendEmailFn)

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      animal: true,
      media: true,
    },
  })

  if (!post) {
    return { ok: false, reason: 'POST_NOT_FOUND' as const }
  }

  // Only notify for published posts
  const status = String((post as any).status || '')
  if (status !== 'PUBLISHED') {
    return { ok: true, skipped: true, reason: 'NOT_PUBLISHED' as const }
  }

  const animalId = String((post as any).animalId || post.animal?.id || '')
  if (!animalId) {
    return { ok: false, reason: 'NO_ANIMAL' as const }
  }

  // Find ACTIVE subscriptions for this animal
  const subs = await prisma.subscription.findMany({
    where: {
      animalId,
      status: { in: ['ACTIVE'] as any },
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  })

  const recipients = subs
    .map((s) => s.user)
    .filter((u): u is { id: string; email: string } => Boolean(u?.id && u?.email))

  if (recipients.length === 0) {
    return { ok: true, notified: 0, emailed: 0 }
  }

  // Create notifications (idempotency: simplest = always create; optional improvement later)
  // Assumes Notification model exists with userId, title, body, postId, animalId, etc.
  let created = 0
  try {
    const rows = recipients.map((u) => ({
      userId: u.id,
      title: 'Nový příspěvek u vašeho adoptovaného zvířete',
      body: post.title || 'Byl publikován nový příspěvek.',
      postId: post.id,
      animalId,
      readAt: null as any,
    }))

    const r = await prisma.notification.createMany({
      data: rows as any,
      skipDuplicates: false as any,
    })

    created = Number((r as any)?.count || 0)
  } catch (e) {
    // If createMany fails (schema mismatch), do not kill the whole approval flow
    console.warn('[notifyUsersAboutNewPost] notification.createMany failed', e)
  }

  // Emails
  let emailed = 0
  if (sendEmail) {
    const animalName = (post.animal?.jmeno || post.animal?.name || 'Zvíře').toString()
    const subject = `Dogpoint – nový příspěvek: ${animalName}`
    const url = `${appBase()}/zvirata/${animalId}#posts`

    const introHtml = `
      Dobrý den,<br />
      byl publikován nový příspěvek u vašeho adoptovaného zvířete: <strong>${escapeInline(animalName)}</strong>.<br />
      <br />
      <strong>${escapeInline(post.title || '')}</strong>
    `.trim()

    const { html, text } = renderDogpointEmailLayout({
      title: 'Nový příspěvek',
      introHtml,
      buttonText: 'Zobrazit příspěvek',
      buttonUrl: url,
      footerNoteHtml:
        '<strong>Bezpečnostní upozornění:</strong> Dogpoint po vás nikdy nebude chtít heslo e-mailem ani telefonicky.',
      plainTextFallbackUrl: url,
    })

    await Promise.all(
      recipients.map(async (u) => {
        try {
          await opts.sendEmailFn!(u.email, subject, html, text)
          emailed += 1
        } catch (e) {
          console.warn('[notifyUsersAboutNewPost] email failed', { to: u.email })
        }
      }),
    )
  }

  return { ok: true, notified: created, emailed }
}

function escapeInline(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}