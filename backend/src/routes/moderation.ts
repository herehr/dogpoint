// backend/src/routes/moderation.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { ContentStatus, Role } from '@prisma/client'

const router = Router()

function isStaff(role?: Role | string): boolean {
  return (
    role === Role.ADMIN ||
    role === Role.MODERATOR ||
    role === 'ADMIN' ||
    role === 'MODERATOR'
  )
}

/* ──────────────────────────────────────────
   Approve animal
   POST /api/moderation/animals/:id/approve
   Roles: ADMIN or MODERATOR
─────────────────────────────────────────── */

router.post(
  '/animals/:id/approve',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
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

      // Already published? just return it
      if (existing.status === ContentStatus.PUBLISHED) {
        res.json(existing)
        return
      }

      const updated = await prisma.animal.update({
        where: { id },
        data: {
          status: ContentStatus.PUBLISHED,
          approvedById: user.id,
        },
        include: {
          galerie: true,
        },
      })

      res.json(updated)
    } catch (e: any) {
      console.error('POST /api/moderation/animals/:id/approve error:', {
        id,
        message: e?.message,
        code: e?.code,
        meta: e?.meta,
        stack: e?.stack,
      })
      res.status(500).json({ error: 'Internal error approving animal' })
    }
  },
)

/* ──────────────────────────────────────────
   Approve post
   POST /api/moderation/posts/:id/approve
   Roles: ADMIN or MODERATOR
─────────────────────────────────────────── */

router.post(
  '/posts/:id/approve',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as { id: string; role: Role | string } | undefined

    if (!user || !isStaff(user.role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const id = String(req.params.id)

    try {
      const existing = await prisma.post.findUnique({
        where: { id },
        include: { animal: true },
      })

      if (!existing) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      if (existing.status === ContentStatus.PUBLISHED) {
        res.json(existing)
        return
      }

      const updated = await prisma.post.update({
        where: { id },
        data: {
          status: ContentStatus.PUBLISHED,
          approvedById: user.id,
        },
        include: {
          media: true,
          animal: true,
        },
      })

      res.json(updated)
    } catch (e: any) {
      console.error('POST /api/moderation/posts/:id/approve error:', {
        id,
        message: e?.message,
        code: e?.code,
        meta: e?.meta,
        stack: e?.stack,
      })
      res.status(500).json({ error: 'Internal error approving post' })
    }
  },
)

export default router