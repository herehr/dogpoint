// backend/src/routes/posts.ts
import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { ContentStatus, Role } from '@prisma/client'
import { notifyApproversAboutNewPost } from '../services/moderationNotifications'

const router = Router()

/* ──────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────── */

type IncomingMedia = { url: string; typ?: string }

/**
 * Public endpoints: if a token is present, attach req.user (id, role).
 * Invalid/expired token is silently ignored.
 */
function tryAttachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || ''
  const [, token] = header.split(' ')
  const secret = process.env.JWT_SECRET || ''
  if (!token || !secret) return next()

  try {
    const decoded = jwt.verify(token, secret) as any
    // req.user is added via global augmentation in authJwt.ts
    req.user = { id: decoded.id || decoded.sub, role: decoded.role }
  } catch {
    // ignore invalid token
  }
  next()
}

/**
 * Normalize media from body.media into array of { url, typ }
 */
function normalizeMedia(input: any): IncomingMedia[] {
  const arr: any[] = Array.isArray(input?.media) ? input.media : []
  return arr
    .map((x: any) =>
      typeof x === 'string'
        ? { url: x }
        : { url: x?.url, typ: x?.typ }
    )
    .filter((m: any): m is IncomingMedia => !!m.url)
    .map((m: IncomingMedia) => ({ url: m.url, typ: m.typ ?? 'image' }))
}

function isStaff(role?: string | Role): boolean {
  return (
    role === 'ADMIN' ||
    role === 'MODERATOR' ||
    role === Role.ADMIN ||
    role === Role.MODERATOR
  )
}

/* ──────────────────────────────────────────────────────────
   Shared list handler (public, only PUBLISHED)
─────────────────────────────────────────────────────────── */

async function listPosts(req: Request, res: Response): Promise<void> {
  try {
    const animalId = req.query.animalId ? String(req.query.animalId) : undefined
    const posts = await prisma.post.findMany({
      where: {
        active: true,
        status: ContentStatus.PUBLISHED,
        ...(animalId ? { animalId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { media: true },
    })
    res.json(posts)
  } catch (e: any) {
    console.error('GET /api/posts error:', e)
    res.status(500).json({ error: 'Internal error fetching posts' })
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/posts/public (public list)
   GET /api/posts        (public list)
   Optional: ?animalId=...
─────────────────────────────────────────────────────────── */

router.get('/public', tryAttachUser, listPosts)
router.get('/', tryAttachUser, listPosts)

/* ──────────────────────────────────────────────────────────
   GET pending posts (staff only)
   GET /api/posts/pending
─────────────────────────────────────────────────────────── */

router.get(
  '/pending',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as { id: string; role: Role | string } | undefined
    if (!user || !isStaff(user.role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    try {
      const animalId = req.query.animalId ? String(req.query.animalId) : undefined
      const posts = await prisma.post.findMany({
        where: {
          active: true,
          status: ContentStatus.PENDING_REVIEW,
          ...(animalId ? { animalId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { media: true, animal: true },
      })
      res.json(posts)
    } catch (e: any) {
      console.error('GET /api/posts/pending error:', e)
      res.status(500).json({ error: 'Internal error fetching pending posts' })
    }
  },
)

/* ──────────────────────────────────────────────────────────
   GET /api/posts/:id  (public detail – only active + PUBLISHED)
─────────────────────────────────────────────────────────── */

router.get(
  '/:id',
  tryAttachUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const post = await prisma.post.findUnique({
        where: { id: String(req.params.id) },
        include: { media: true },
      })

      // Do not leak drafts or pending posts to the public
      if (!post || !post.active || post.status !== ContentStatus.PUBLISHED) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      res.json(post)
    } catch (e: any) {
      console.error('GET /api/posts/:id error:', e)
      res.status(500).json({ error: 'Internal error fetching post' })
    }
  },
)

/* ──────────────────────────────────────────────────────────
   POST /api/posts  (ADMIN/MODERATOR)
   - ADMIN: status = PUBLISHED (no approval needed)
   - MODERATOR: status = PENDING_REVIEW + notifications
─────────────────────────────────────────────────────────── */

router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isStaff(req.user?.role)) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }

      const { animalId, title, body, active } = (req.body || {}) as any
      const media = normalizeMedia(req.body)

      if (!animalId) {
        res.status(400).json({ error: 'animalId required' })
        return
      }
      if (!title || String(title).trim() === '') {
        res.status(400).json({ error: 'title required' })
        return
      }

      const animal = await prisma.animal.findUnique({
        where: { id: String(animalId) },
      })
      if (!animal) {
        res.status(404).json({ error: 'Animal not found' })
        return
      }

      const user = req.user as { id: string; role: Role | string }
      const isAdmin = user.role === Role.ADMIN || user.role === 'ADMIN'
      const initialStatus = isAdmin
        ? ContentStatus.PUBLISHED
        : ContentStatus.PENDING_REVIEW

      const authorId = user.id

      const created = await prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            title: String(title),
            body: body ? String(body) : null,
            active: active === undefined ? true : Boolean(active),
            animalId: String(animalId),
            authorId,
            status: initialStatus,
            createdById: authorId,
            approvedById: isAdmin ? authorId : null,
          },
        })

        if (media.length) {
          await tx.postMedia.createMany({
            data: media.map((m: IncomingMedia) => ({
              postId: post.id,
              url: m.url,
              typ: m.typ ?? 'image',
            })),
          })
        }

        return tx.post.findUnique({
          where: { id: post.id },
          include: { media: true },
        })
      })

      if (!created) {
        res.status(500).json({ error: 'Internal error creating post' })
        return
      }

      // Moderators: send notifications to approvers
      if (!isAdmin) {
        notifyApproversAboutNewPost(
          created.id,
          created.title,
          animal.jmeno ?? animal.name ?? null,
          user.id,
        ).catch((e) => {
          console.error('[notifyApproversAboutNewPost] failed', e?.message)
        })
      }

      res.status(201).json(created)
    } catch (e: any) {
      console.error('POST /api/posts error:', {
        message: e?.message,
        code: e?.code,
        meta: e?.meta,
        stack: e?.stack,
      })
      res.status(500).json({ error: 'Internal error creating post' })
    }
  },
)

/* ──────────────────────────────────────────────────────────
   PATCH /api/posts/:id  (ADMIN/MODERATOR)
─────────────────────────────────────────────────────────── */

router.patch(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isStaff(req.user?.role)) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }

      const id = String(req.params.id)
      const body = (req.body || {}) as any
      const media = normalizeMedia(body)
      const willReplaceMedia = Array.isArray(body.media)

      const exists = await prisma.post.findUnique({ where: { id } })
      if (!exists) {
        res.status(404).json({ error: 'Not found' })
        return
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.post.update({
          where: { id },
          data: {
            title: body.title ?? undefined,
            body: body.body ?? undefined,
            active: body.active ?? undefined,
          },
        })

        if (willReplaceMedia) {
          await tx.postMedia.deleteMany({ where: { postId: id } })
          if (media.length) {
            await tx.postMedia.createMany({
              data: media.map((m: IncomingMedia) => ({
                postId: id,
                url: m.url,
                typ: m.typ ?? 'image',
              })),
            })
          }
        }

        return tx.post.findUnique({
          where: { id },
          include: { media: true },
        })
      })

      res.json(updated)
    } catch (e: any) {
      console.error('PATCH /api/posts/:id error:', e)
      res.status(500).json({ error: 'Internal error updating post' })
    }
  },
)

/* ──────────────────────────────────────────────────────────
   APPROVE /api/posts/:id/approve  (ADMIN/MODERATOR)
─────────────────────────────────────────────────────────── */

router.post(
  '/:id/approve',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as { id: string; role: Role | string } | undefined
    if (!user || !isStaff(user.role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const id = String(req.params.id)

    try {
      const existing = await prisma.post.findUnique({ where: { id } })
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
      })

      res.json(updated)
    } catch (e: any) {
      console.error('POST /api/posts/:id/approve error:', e)
      res.status(500).json({ error: 'Internal error approving post' })
    }
  },
)

/* ──────────────────────────────────────────────────────────
   DELETE /api/posts/:id  (ADMIN/MODERATOR, soft delete)
─────────────────────────────────────────────────────────── */

router.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isStaff(req.user?.role)) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      const id = String(req.params.id)

      await prisma.$transaction(async (tx) => {
        await tx.postMedia.deleteMany({ where: { postId: id } })
        await tx.post.update({
          where: { id },
          data: { active: false },
        })
      })

      res.status(204).end()
    } catch (e: any) {
      console.error('DELETE /api/posts/:id error:', e)
      res.status(500).json({ error: 'Internal error deleting post' })
    }
  },
)

export default router