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
  mediaUrls?: string[] // legacy/optional list of already-uploaded URLs
}

interface UpdatePostBody {
  title?: string
  body?: string
}

type IncomingMedia = { url: string; typ?: string }

/* ------------------------------------------------------------------ */
/* POST /api/posts                                                    */
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
          title: title.trim(),
          body: body ?? null,
          active: true,
          authorId: req.user?.id ?? null,
          publishedAt: now, // keep as-is
        },
      })

      // legacy: mediaUrls (strings)
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

    // rules
    if (role === 'MODERATOR') {
      if (post.status !== 'PENDING_REVIEW') {
        return res.status(403).json({
          message: 'Moderátor může upravit jen příspěvek čekající na schválení.',
        })
      }
    } else if (role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' })
    }

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
/* ADMIN only (enforced in routes)                                    */
/* Body: { media: [{ url, typ? }] } OR { url, typ? }                  */
/* ------------------------------------------------------------------ */
export const addPostMedia = async (req: ReqWithUser, res: Response) => {
  const { id } = req.params
  if (!id) return res.status(400).json({ error: 'Missing post id' })

  try {
    // Accept both shapes:
    // 1) { media: [...] }
    // 2) { url: "...", typ: "image|video" }
    const body = (req.body || {}) as any
    const incoming: IncomingMedia[] = Array.isArray(body.media)
      ? body.media
      : body.url
        ? [{ url: String(body.url), typ: body.typ ? String(body.typ) : undefined }]
        : []

    const cleaned = incoming
      .map((m) => ({
        url: String(m.url || '').trim(),
        typ: String(m.typ || 'image').trim() || 'image',
      }))
      .filter((m) => m.url.length > 0)

    if (cleaned.length === 0) {
      return res.status(400).json({ error: 'No media provided' })
    }

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, active: true },
    })
    if (!post) return res.status(404).json({ error: 'Post not found' })
    if (post.active === false) return res.status(400).json({ error: 'Post is inactive' })

    await prisma.postMedia.createMany({
      data: cleaned.map((m) => ({
        postId: id,
        url: m.url,
        typ: m.typ || 'image',
      })),
    })

    const updated = await prisma.post.findUnique({
      where: { id },
      include: { media: true },
    })

    return res.json(updated)
  } catch (err) {
    console.error('[addPostMedia] error', err)
    return res.status(500).json({ error: 'Failed to add media' })
  }
}

/* ------------------------------------------------------------------ */
/* DELETE /api/posts/:id/media/:mediaId                                */
/* ADMIN only (enforced in routes)                                    */
/* ------------------------------------------------------------------ */
export const deletePostMedia = async (req: ReqWithUser, res: Response) => {
  const { id, mediaId } = req.params
  if (!id) return res.status(400).json({ error: 'Missing post id' })
  if (!mediaId) return res.status(400).json({ error: 'Missing media id' })

  try {
    const media = await prisma.postMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, postId: true },
    })
    if (!media) return res.status(404).json({ error: 'Media not found' })
    if (media.postId !== id) {
      return res.status(400).json({ error: 'Media does not belong to this post' })
    }

    await prisma.postMedia.delete({ where: { id: mediaId } })

    const updated = await prisma.post.findUnique({
      where: { id },
      include: { media: true },
    })

    return res.json(updated)
  } catch (err) {
    console.error('[deletePostMedia] error', err)
    return res.status(500).json({ error: 'Failed to delete media' })
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/posts/public?animalId=...                                 */
/* ------------------------------------------------------------------ */
export const getPublicPosts = async (req: Request, res: Response) => {
  try {
    const animalId = req.query.animalId as string | undefined

    const where: any = { active: true }
    if (animalId) where.animalId = animalId

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' }, // you use createdAt as visible date
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
        createdAt: { gt: sinceDate },
      },
    })

    return res.json({ newPosts: count })
  } catch (err) {
    console.error('[countNewPostsSince] error', err)
    return res.status(500).json({ message: 'Nepodařilo se spočítat nové příspěvky.' })
  }
}