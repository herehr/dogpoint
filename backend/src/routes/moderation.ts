// backend/src/routes/moderation.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { ContentStatus, Role } from '@prisma/client'

import { notifyUsersAboutNewPost } from '../services/notifyNewPost'

// IMPORTANT: choose ONE of these depending on your email service exports:
// If you have sendEmailSafe({to,subject,html,text})
import { sendEmailSafe } from '../services/email'
// If you only have sendEmail(to, subject, html, text?)
// import { sendEmail } from '../services/email'

const router = Router()

function isStaff(role?: Role | string): boolean {
  return role === Role.ADMIN || role === Role.MODERATOR || role === 'ADMIN' || role === 'MODERATOR'
}

/**
 * Adapter: notifyNewPost expects (to, subject, html, text?)
 * We wrap your email sender to that signature.
 */
const sendEmailFn = async (to: string, subject: string, html: string, text?: string) => {
  // If you use sendEmailSafe
  await sendEmailSafe({ to, subject, html, text })

  // If you use sendEmail instead, use this and remove sendEmailSafe import above:
  // await sendEmail(to, subject, html, text)
}

/* ──────────────────────────────────────────
   Approve animal
   POST /api/moderation/animals/:id/approve
─────────────────────────────────────────── */
router.post('/animals/:id/approve', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as { id: string; role: Role | string } | undefined
  if (!user || !isStaff(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const id = String(req.params.id)

  try {
    const existing = await prisma.animal.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    if (existing.status === ContentStatus.PUBLISHED) {
      res.json(existing)
      return
    }

    const updated = await prisma.animal.update({
      where: { id },
      data: { status: ContentStatus.PUBLISHED, approvedById: user.id },
      include: { galerie: true },
    })

    console.log('[moderation] animal approved', { animalId: id, by: user.id })
    res.json(updated)
  } catch (e: any) {
    console.error('[moderation] approve animal failed', e?.message || e)
    res.status(500).json({ error: 'Internal error approving animal' })
  }
})

/* ──────────────────────────────────────────
   Approve post
   POST /api/moderation/posts/:id/approve
   Must set status=PUBLISHED, then notify adopters.
─────────────────────────────────────────── */
router.post('/posts/:id/approve', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as { id: string; role: Role | string } | undefined
  if (!user || !isStaff(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const id = String(req.params.id)

  try {
    const existing = await prisma.post.findUnique({
      where: { id },
      include: { animal: true, media: true },
    })

    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    console.log('[moderation] approve post requested', {
      postId: id,
      beforeStatus: String((existing as any).status),
      animalId: String((existing as any).animalId || existing.animal?.id || ''),
      by: user.id,
    })

    // If already PUBLISHED, return but ALSO log (no notify again)
    if (existing.status === ContentStatus.PUBLISHED) {
      console.log('[moderation] post already published -> skipping notify', { postId: id })
      res.json(existing)
      return
    }

    // Force PUBLISHED
    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        approvedById: user.id,
        // optional: if you track publishedAt
        publishedAt: new Date() as any,
      } as any,
      include: { animal: true, media: true },
    })

    console.log('[moderation] post approved', {
      postId: updated.id,
      afterStatus: String((updated as any).status),
      animalId: String((updated as any).animalId || updated.animal?.id || ''),
    })

    // Notify + email (must never break approval)
    try {
      const result = await notifyUsersAboutNewPost(updated.id, {
        sendEmail: true,
        sendEmailFn,
      })
      console.log('[moderation] notifyUsersAboutNewPost result', result)
    } catch (err: any) {
      console.warn('[moderation] notifyUsersAboutNewPost FAILED', err?.message || err)
    }

    res.json(updated)
  } catch (e: any) {
    console.error('[moderation] approve post failed', e?.message || e)
    res.status(500).json({ error: 'Internal error approving post' })
  }
})

export default router