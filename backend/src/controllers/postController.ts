// backend/src/controllers/postController.ts
import { Request, Response } from 'express'
import { prisma } from '../prisma'

interface AuthUserPayload {
  id: string
  role: string
  email?: string
}

type ReqWithUser = Request & { user?: AuthUserPayload }

/* ------------------------------------------------------------------ */
/* Helper types                                                       */
/* ------------------------------------------------------------------ */

interface CreatePostBody {
  animalId?: string
  title?: string
  body?: string
  mediaUrls?: string[] // optional list of already-uploaded media URLs
}

interface UpdatePostBody {
  title?: string
  body?: string
}

type IncomingMedia = { url: string; typ?: string }
type AddMediaBody = { media?: IncomingMedia[]; mediaUrls?: string[] }

/* ------------------------------------------------------------------ */
/* POST /api/posts                                                    */
/* Create post (ADMIN / MODERATOR)                                    */
/* ------------------------------------------------------------------ */
export const createPost = async (req: ReqWithUser, res: Response) => {
  try {
    const { animalId, title, body, mediaUrls }: CreatePostBody = req.body || {}

    if (!animalId || !title) {
      return res.status(400).json({ message: 'animalId a title jsou povinné.' })
    }

    const animal = await prisma.animal.findUnique({ where: { id: animalId } })
    if (!animal) {
      return res.status(404).json({ message: 'Zvíře nebylo nalezeno.' })
    }

    const now = new Date()

    const createdPost = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          animalId,
          title,
          body: body ?? null,
          active: true,
          authorId: req.user?.id ?? null,
          publishedAt: now, // keep as-is
          // status defaults to PENDING_REVIEW in Prisma schema
          createdById: req.user?.id ?? null,
        },
      })

      if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
        await tx.postMedia.createMany({
          data: mediaUrls.map((url) => ({
            url,
            typ: 'image',
            postId: post.id,
          })),
        })
      }

      return post
    })

    const postWithMedia = await prisma.post.findUnique({
      where: { id: createdPost.id },
      include: { media: true },
    })

    return res.status(201).json(postWithMedia)
  } catch (err) {
    console.error('[createPost] error', err)
    return res.status(500).json({ message: 'Nepodařilo se uložit příspěvek.' })
  }
}

/* ------------------------------------------------------------------ */
/* PATCH /api/posts/:id                                               */
/* Edit post                                                          */
/* - ADMIN: can edit anytime                                          */
/* - MODERATOR: only if status === PENDING_REVIEW                     */
/* ------------------------------------------------------------------ */
export const updatePost = async (req: ReqWithUser, res: Response) => {
  const { id } = req.params
  const { title, body }: UpdatePostBody = req.body || {}

  if (!id) return res.status(400).json({ message: 'Missing post id' })

  try {
    const role = req.user?.role
    if (!role) return res.status(401).json({ message: 'Unauthorized' })

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, status: true, active: true },
    })

    if (!post) return res.status(404).json({ message: 'Post not found' })
    if (post.active === false) return res.status(400).json({ message: 'Post is inactive' })

    // permission rules
    if (role === 'MODERATOR') {
      if (post.status !== 'PENDING_REVIEW') {
        return res.status(403).json({
          message: 'Moderátor může upravit jen příspěvek čekající na schválení.',
        })
      }
    } else if (role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // validate inputs
    const data: any = {}
    if (typeof title === 'string') data.title = title.trim()
    if (typeof body === 'string') data.body = body

    if (!('title' in data) && !('body' in data)) {
      return res.status(400).json({ message: 'Nothing to update' })
    }

    const updated = await prisma.post.update({
      where: { id },
      data,
      include: { media: true },
    })

    return res.json(updated)
  } catch (err) {
    console.error('[updatePost] error', err)
    return res.status(500).json({ message: 'Failed to update post' })
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/posts/:id/media                                          */
/* ADMIN only: add media entries                                      */
/* body: { media:[{url,typ?}] } OR { mediaUrls:[...] }                */
/* ------------------------------------------------------------------ */
export const addPostMedia = async (req: ReqWithUser, res: Response) => {
  const { id } = req.params
  if (!id) return res.status(400).json({ message: 'Missing post id' })

  try {
    const role = req.user?.role
    if (role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' })

    const body = (req.body || {}) as AddMediaBody

    const items: IncomingMedia[] = Array.isArray(body.media)
      ? body.media
      : Array.isArray(body.mediaUrls)
        ? body.mediaUrls.map((u) => ({ url: String(u), typ: 'image' }))
        : []

    const clean = items
      .map((m) => ({
        url: String(m.url || '').trim(),
        typ: String(m.typ || 'image').trim(),
      }))
      .filter((m) => m.url.length > 0)

    if (clean.length === 0) {
      return res.status(400).json({ message: 'No media provided' })
    }

    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return res.status(404).json({ message: 'Post not found' })

    await prisma.postMedia.createMany({
      data: clean.map((m) => ({
        postId: id,
        url: m.url,
        typ: m.typ,
      })),
    })

    const updated = await prisma.post.findUnique({
      where: { id },
      include: { media: true },
    })

    return res.json(updated)
  } catch (err) {
    console.error('[addPostMedia] error', err)
    return res.status(500).json({ message: 'Failed to add media' })
  }
}

/* ------------------------------------------------------------------ */
/* DELETE /api/posts/media/:mediaId                                   */
/* ADMIN only: delete one media item                                  */
/* ------------------------------------------------------------------ */
export const deletePostMedia = async (req: ReqWithUser, res: Response) => {
  const { mediaId } = req.params
  if (!mediaId) return res.status(400).json({ message: 'Missing mediaId' })

  try {
    const role = req.user?.role
    if (role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' })

    await prisma.postMedia.delete({ where: { id: mediaId } })
    return res.json({ ok: true })
  } catch (err: any) {
    console.error('[deletePostMedia] error', err)
    if (err?.code === 'P2025') return res.status(404).json({ message: 'Media not found' })
    return res.status(500).json({ message: 'Failed to delete media' })
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/posts/public?animalId=...                                 */
/* Public posts                                                       */
/* ------------------------------------------------------------------ */
export const getPublicPosts = async (req: Request, res: Response) => {
  try {
    const animalId = req.query.animalId as string | undefined

    const where: any = { active: true }
    // If you ever want only approved public, add:
    // where.status = 'PUBLISHED'

    if (animalId) where.animalId = animalId

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' }, // ✅ using createdAt as your post date
      include: { media: true },
    })

    return res.json(posts)
  } catch (err) {
    console.error('[getPublicPosts] error', err)
    return res.status(500).json({ message: 'Nepodařilo se načíst příspěvky.' })
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/posts/count-new?animalId=...&since=ISO_DATE               */
/* ------------------------------------------------------------------ */
export const countNewPostsSince = async (req: Request, res: Response) => {
  try {
    const animalId = req.query.animalId as string | undefined
    const since = req.query.since as string | undefined

    if (!animalId || !since) {
      return res.status(400).json({ message: 'animalId a since jsou povinné.' })
    }

    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ message: 'Neplatný formát času since.' })
    }

    const count = await prisma.post.count({
      where: {
        animalId,
        active: true,
        createdAt: { gt: sinceDate }, // ✅ consistent with createdAt date logic
      },
    })

    return res.json({ newPosts: count })
  } catch (err) {
    console.error('[countNewPostsSince] error', err)
    return res.status(500).json({ message: 'Nepodařilo se spočítat nové příspěvky.' })
  }
}