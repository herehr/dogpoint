import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { ContentStatus, Role } from '@prisma/client'

import { notifyUsersAboutNewPost } from '../services/notifyNewPost'
import { sendEmailSafe } from '../services/email'

const router = Router()

function isStaff(role?: Role | string): boolean {
  return role === Role.ADMIN || role === Role.MODERATOR || role === 'ADMIN' || role === 'MODERATOR'
}

// notifyNewPost.ts expects ONE-arg function: (args) => Promise<void>
const sendEmailFn = async (args: { to: string; subject: string; html: string; text?: string }) => {
  await sendEmailSafe(args)
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

    res.json(updated)
  } catch (e: any) {
    console.error('POST /api/moderation/animals/:id/approve error:', e?.message || e)
    res.status(500).json({ error: 'Internal error approving animal' })
  }
})

/* ──────────────────────────────────────────
   Approve post
   POST /api/moderation/posts/:id/approve
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

    console.log('[moderation] approve post', {
      postId: id,
      beforeStatus: String((existing as any).status),
      animalId: String((existing as any).animalId || existing.animal?.id || ''),
    })

    if (existing.status === ContentStatus.PUBLISHED) {
      console.log('[moderation] already published -> skipping notify', { postId: id })
      res.json(existing)
      return
    }

    // Force to PUBLISHED
    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        approvedById: user.id,
        publishedAt: new Date() as any, // harmless if field exists; ignored if not
      } as any,
      include: { animal: true, media: true },
    })

    console.log('[moderation] post updated', {
      postId: updated.id,
      afterStatus: String((updated as any).status),
      animalId: String((updated as any).animalId || updated.animal?.id || ''),
    })

    // Notify adopters (and email)
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
    console.error('POST /api/moderation/posts/:id/approve error:', e?.message || e)
    res.status(500).json({ error: 'Internal error approving post' })
  }
})

export default router