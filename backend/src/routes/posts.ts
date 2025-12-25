// backend/src/routes/posts.ts
import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { ContentStatus, Role } from '@prisma/client'
import { notifyApproversAboutNewPost } from '../services/moderationNotifications'
import { notifyUsersAboutNewPost } from '../services/notifyNewPost'
import { sendEmailSafe } from '../services/email'

const router = Router()

/* ──────────────────────────────────────────────────────────
   Types + role helpers (avoid TS narrowing issues)
─────────────────────────────────────────────────────────── */

type IncomingMedia = { url: string; typ?: string }

// keep wide on purpose (some middleware typings narrow role incorrectly)
type AnyRole = Role | 'ADMIN' | 'MODERATOR' | 'USER' | string | undefined | null

function getRole(req: Request): AnyRole {
  return (req.user as any)?.role as AnyRole
}

function getUserId(req: Request): string | null {
  const id = (req.user as any)?.id
  return id ? String(id) : null
}

function isAdminRole(role: AnyRole): boolean {
  return role === Role.ADMIN || role === 'ADMIN'
}

function isStaff(role: AnyRole): boolean {
  return role === Role.ADMIN || role === Role.MODERATOR || role === 'ADMIN' || role === 'MODERATOR'
}

/* ──────────────────────────────────────────────────────────
   Optional: attach user for public routes (silent if invalid)
─────────────────────────────────────────────────────────── */

function tryAttachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || ''
  const [, token] = header.split(' ')
  const secret = process.env.JWT_SECRET || ''
  if (!token || !secret) return next()

  try {
    const decoded = jwt.verify(token, secret) as any
    req.user = { id: decoded.id || decoded.sub, role: decoded.role }
  } catch {
    // ignore invalid token
  }
  next()
}

/* ──────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────── */

function normalizeMedia(input: any): IncomingMedia[] {
  const arr: any[] = Array.isArray(input?.media) ? input.media : []
  return arr
    .map((x: any) => (typeof x === 'string' ? { url: x } : { url: x?.url, typ: x?.typ }))
    .filter((m: any): m is IncomingMedia => !!m.url)
    .map((m: IncomingMedia) => ({ url: String(m.url), typ: m.typ ?? 'image' }))
}

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
   GET /api/posts/public  (public list)
   GET /api/posts         (public list)
─────────────────────────────────────────────────────────── */

router.get('/public', tryAttachUser, listPosts)
router.get('/', tryAttachUser, listPosts)

/* ──────────────────────────────────────────────────────────
   GET /api/posts/pending (staff only)
─────────────────────────────────────────────────────────── */

router.get('/pending', requireAuth, async (req: Request, res: Response) => {
  const role = getRole(req)
  if (!isStaff(role)) {
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
})

/* ──────────────────────────────────────────────────────────
   MEDIA (ADMIN only)
   POST   /api/posts/:id/media
   DELETE /api/posts/:id/media/:mediaId
─────────────────────────────────────────────────────────── */

router.post('/:id/media', requireAuth, async (req: Request, res: Response) => {
  const role = getRole(req)
  if (!isAdminRole(role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    const postId = String(req.params.id)
    const body = (req.body || {}) as any

    // Accept: { media:[{url,typ}]} OR {url,typ}
    const incoming: any[] = Array.isArray(body.media) ? body.media : body.url ? [{ url: body.url, typ: body.typ }] : []

    const cleaned = incoming
      .map((m: any) => ({
        url: String(m?.url || '').trim(),
        typ: String(m?.typ || 'image').trim() || 'image',
      }))
      .filter((m: any) => m.url.length > 0)

    if (!cleaned.length) {
      res.status(400).json({ error: 'No media provided' })
      return
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, active: true },
    })

    if (!post || !post.active) {
      res.status(404).json({ error: 'Post not found' })
      return
    }

    await prisma.postMedia.createMany({
      data: cleaned.map((m: any) => ({ postId, url: m.url, typ: m.typ })),
    })

    const updated = await prisma.post.findUnique({
      where: { id: postId },
      include: { media: true },
    })

    res.json(updated)
  } catch (e: any) {
    console.error('POST /api/posts/:id/media error:', e)
    res.status(500).json({ error: 'Failed to add media' })
  }
})

router.delete('/:id/media/:mediaId', requireAuth, async (req: Request, res: Response) => {
  const role = getRole(req)
  if (!isAdminRole(role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    const postId = String(req.params.id)
    const mediaId = String(req.params.mediaId)

    const media = await prisma.postMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, postId: true },
    })

    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    if (media.postId !== postId) {
      res.status(400).json({ error: 'Media does not belong to this post' })
      return
    }

    await prisma.postMedia.delete({ where: { id: mediaId } })

    const updated = await prisma.post.findUnique({
      where: { id: postId },
      include: { media: true },
    })

    res.json(updated)
  } catch (e: any) {
    console.error('DELETE /api/posts/:id/media/:mediaId error:', e)
    res.status(500).json({ error: 'Failed to delete media' })
  }
})

/* ──────────────────────────────────────────────────────────
   GET /api/posts/:id  (public detail – only active + PUBLISHED)
─────────────────────────────────────────────────────────── */

router.get('/:id', tryAttachUser, async (req: Request, res: Response) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: String(req.params.id) },
      include: { media: true },
    })

    if (!post || !post.active || post.status !== ContentStatus.PUBLISHED) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json(post)
  } catch (e: any) {
    console.error('GET /api/posts/:id error:', e)
    res.status(500).json({ error: 'Internal error fetching post' })
  }
})

/* ──────────────────────────────────────────────────────────
   POST /api/posts  (ADMIN/MODERATOR)
─────────────────────────────────────────────────────────── */

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const role = getRole(req)
    if (!isStaff(role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const { animalId, title, body, active } = (req.body || {}) as any
    const media = normalizeMedia(req.body)

    if (!animalId) return void res.status(400).json({ error: 'animalId required' })
    if (!title || String(title).trim() === '') {
      res.status(400).json({ error: 'title required' })
      return
    }

    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) } })
    if (!animal) {
      res.status(404).json({ error: 'Animal not found' })
      return
    }

    const authorId = getUserId(req) || ''
    const admin = isAdminRole(role)
    const initialStatus = admin ? ContentStatus.PUBLISHED : ContentStatus.PENDING_REVIEW

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
          approvedById: admin ? authorId : null,
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

    if (!admin) {
      notifyApproversAboutNewPost(
        created.id,
        created.title,
        (animal as any).jmeno ?? (animal as any).name ?? null,
        authorId,
      ).catch((e) => console.error('[notifyApproversAboutNewPost] failed', e?.message))
    } else {
      // ✅ ADMIN published immediately -> notify adopters now (best-effort)
      try {
        await notifyUsersAboutNewPost(created.id, { sendEmail: true, sendEmailFn: sendEmailSafe })
      } catch (e) {
        console.warn('[notifyUsersAboutNewPost] failed after admin create', e)
      }
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
})

/* ──────────────────────────────────────────────────────────
   PATCH /api/posts/:id  (ADMIN/MODERATOR)
─────────────────────────────────────────────────────────── */

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const role = getRole(req)
    if (!isStaff(role)) {
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
})

/* ──────────────────────────────────────────────────────────
   APPROVE /api/posts/:id/approve  (ADMIN/MODERATOR)
─────────────────────────────────────────────────────────── */

router.post('/:id/approve', requireAuth, async (req: Request, res: Response) => {
  const role = getRole(req)
  if (!isStaff(role)) {
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

    if (existing.status === ContentStatus.PUBLISHED) {
      res.json(existing)
      return
    }

    const userId = getUserId(req) || ''

    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        approvedById: userId,
      },
      include: { animal: true, media: true },
    })

    // ✅ notify adopters after approval (best-effort; never block approve)
    try {
      await notifyUsersAboutNewPost(updated.id, { sendEmail: true, sendEmailFn: sendEmailSafe })
    } catch (e) {
      console.warn('[notifyUsersAboutNewPost] failed after approve', e)
    }

    res.json(updated)
  } catch (e: any) {
    console.error('POST /api/posts/:id/approve error:', e)
    res.status(500).json({ error: 'Internal error approving post' })
  }
})

/* ──────────────────────────────────────────────────────────
   DELETE /api/posts/:id  (ADMIN/MODERATOR, soft delete)
─────────────────────────────────────────────────────────── */

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const role = getRole(req)
    if (!isStaff(role)) {
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
})

export default router