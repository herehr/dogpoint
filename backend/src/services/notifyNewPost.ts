// backend/src/services/notifyNewPost.ts
import { prisma } from '../prisma'
import { renderDogpointEmailLayout } from './emailTemplates'

type SendEmailFn = (args: { to: string; subject: string; html: string; text?: string }) => Promise<void>

type NotifyOptions = {
  sendEmail?: boolean
  sendEmailFn?: SendEmailFn
}

function appBase(): string {
  return (process.env.APP_BASE_URL || 'https://patron.dog-point.cz').replace(/\/+$/, '')
}

function escapeInline(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

  // In-app notifications (best-effort; never break the approval flow)
  let created = 0
  try {
    const rows = recipients.map((u) => ({
      userId: u.id,
      type: 'POST_PUBLISHED',
      title: 'Tvůj pejsek má pro tebe novinu',
      message: post.title || 'Byl publikován nový příspěvek.',
      postId: post.id,
      animalId,
      readAt: null as any,
    }))

    // If your schema doesn't support createMany or fields differ, this may throw — that's ok.
    const r = await (prisma as any).notification.createMany({
      data: rows as any,
      skipDuplicates: false as any,
    })

    created = Number((r as any)?.count || 0)
  } catch (e) {
    console.warn('[notifyUsersAboutNewPost] notification.createMany failed', e)
    // fallback: try single inserts (still best-effort)
    try {
      for (const u of recipients) {
        try {
          await (prisma as any).notification.create({
            data: {
              userId: u.id,
              type: 'POST_PUBLISHED',
              title: 'Tvůj pejsek má pro tebe novinu',
              message: post.title || 'Byl publikován nový příspěvek.',
              postId: post.id,
              animalId,
              readAt: null as any,
            },
          })
          created += 1
        } catch {}
      }
    } catch {}
  }

  // Emails (unified layout)
  let emailed = 0
  if (sendEmail) {
    const animalName = String((post.animal as any)?.jmeno || post.animal?.name || 'Zvíře')
    const subject = `Tvůj pejsek má pro tebe novinu`
    const url = `${appBase()}/zvirata/${encodeURIComponent(animalId)}#posts`

    // Client requested wording:
    // "Ahoj patrone! (jméno psa) se s tebou chce podělit, co nového zažil. Klikni a zjisti to.
    //  Pac a pusu posílá tým z Dogpointu"
    const introHtml = `
      Ahoj patrone!<br/>
      <strong>${escapeInline(animalName)}</strong> se s tebou chce podělit, co nového zažil. Klikni a zjisti to.
    `.trim()

    const { html, text } = renderDogpointEmailLayout({
      title: 'Tvůj pejsek má pro tebe novinu',
      introHtml,
      buttonText: 'Klikni a zjisti to',
      buttonUrl: url,
      plainTextFallbackUrl: url,
      footerNoteHtml: `
        Pac a pusu posílá<br/>
        <strong>tým z Dogpointu</strong><br/><br/>
        <strong>Bezpečnostní upozornění:</strong> Dogpoint po vás nikdy nebude chtít heslo e-mailem ani telefonicky.
      `.trim(),
    })

    for (const u of recipients) {
      try {
        await opts.sendEmailFn!({ to: u.email, subject, html, text })
        emailed += 1
      } catch {
        console.warn('[notifyUsersAboutNewPost] email failed', { to: u.email })
      }
    }
  }

  return { ok: true, notified: created, emailed }
}