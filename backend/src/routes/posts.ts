// backend/src/routes/posts.ts
import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'

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

function isStaff(role?: string): boolean {
  return role === 'ADMIN' || role === 'MODERATOR'
}

/* ──────────────────────────────────────────────────────────
   Shared list handler
─────────────────────────────────────────────────────────── */

async function listPosts(req: Request, res: Response): Promise<void> {
  try {
    const animalId = req.query.animalId ? String(req.query.animalId) : undefined
    const posts = await prisma.post.findMany({
      where: {
        active: true,
        ...(animalId ? { animalId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { media: true },
    })
    // IMPORTANT: never 404 here – just return [] if none
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
   MUST come before '/:id'
─────────────────────────────────────────────────────────── */

router.get('/public', tryAttachUser, listPosts)
router.get('/',      tryAttachUser, listPosts)

/* ──────────────────────────────────────────────────────────
   GET /api/posts/:id  (public detail)
─────────────────────────────────────────────────────────── */

router.get('/:id', tryAttachUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: String(req.params.id) },
      include: { media: true },
    })
    if (!post || !post.active) {
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
   POST /api/posts  (ONLY ADMIN/MODERATOR)
   Body: { animalId, title, body?, media?: [{url, typ}] | [string], active? }
─────────────────────────────────────────────────────────── */

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

    // ensure animal exists
    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) } })
    if (!animal) {
      res.status(404).json({ error: 'Animal not found' })
      return
    }

    const authorId = req.user!.id // staff-only path → always present

    const created = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          title: String(title),
          body: body ? String(body) : null,
          active: active === undefined ? true : Boolean(active),
          animalId: String(animalId),
          authorId,
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
      return tx.post.findUnique({ where: { id: post.id }, include: { media: true } })
    })

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
   Body can include: { title?, body?, active?, media? }
   If media provided (array), we REPLACE all media.
─────────────────────────────────────────────────────────── */

router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

      return tx.post.findUnique({ where: { id }, include: { media: true } })
    })

    res.json(updated)
  } catch (e: any) {
    console.error('PATCH /api/posts/:id error:', e)
    res.status(500).json({ error: 'Internal error updating post' })
  }
})

/* ──────────────────────────────────────────────────────────
   DELETE /api/posts/:id  (ADMIN/MODERATOR)
─────────────────────────────────────────────────────────── */

router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
})

export default router