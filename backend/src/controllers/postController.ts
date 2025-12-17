// backend/src/controllers/postController.ts
import { Request, Response } from 'express'
import { prisma } from '../prisma'

/**
 * If you have global Express augmentation (req.user),
 * this local type just makes TypeScript happy in this file.
 */
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

/* ------------------------------------------------------------------ */
/* POST /api/posts                                                    */
/* Create post (ADMIN / MODERATOR)                                    */
/* ------------------------------------------------------------------ */
export const createPost = async (req: ReqWithUser, res: Response) => {
  try {
    const { animalId, title, body, mediaUrls }: CreatePostBody = req.body || {}

    if (!animalId || !title) {
      return res.status(400).json({
        message: 'animalId a title jsou povinné.',
      })
    }

    // optional: check that animal exists
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
    })

    if (!animal) {
      return res.status(404).json({
        message: 'Zvíře nebylo nalezeno.',
      })
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
          // keep as-is (your workflow might still use publishedAt)
          publishedAt: now,
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

    // load with media to return full object
    const postWithMedia = await prisma.post.findUnique({
      where: { id: createdPost.id },
      include: { media: true },
    })

    return res.status(201).json(postWithMedia)
  } catch (err) {
    console.error('[createPost] error', err)
    return res.status(500).json({
      message: 'Nepodařilo se uložit příspěvek.',
    })
  }
}

/* ------------------------------------------------------------------ */
/* PATCH /api/posts/:id                                               */
/* Edit post                                                          */
/* - ADMIN: can edit anytime                                           */
/* - MODERATOR: only if status === PENDING_REVIEW                      */
/* ------------------------------------------------------------------ */
export const updatePost = async (req: ReqWithUser, res: Response) => {
  const { id } = req.params
  const { title, body }: UpdatePostBody = req.body || {}

  if (!id) return res.status(400).json({ message: 'Missing post id' })

  try {
    const role = req.user?.role

    if (!role) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, status: true, active: true },
    })

    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    if (post.active === false) {
      return res.status(400).json({ message: 'Post is inactive' })
    }

    // Permission rules
    if (role === 'MODERATOR') {
      if (post.status !== 'PENDING_REVIEW') {
        return res.status(403).json({
          message: 'Moderátor může upravit jen příspěvek čekající na schválení.',
        })
      }
    } else if (role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Validate inputs
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
/* GET /api/posts/public?animalId=...                                 */
/* Public posts (for frontend, animal detail page)                    */
/* ------------------------------------------------------------------ */
export const getPublicPosts = async (req: Request, res: Response) => {
  try {
    const animalId = req.query.animalId as string | undefined

    const where: any = {
      active: true,
      // Optional: if you want ONLY approved posts public, uncomment:
      // status: 'APPROVED',
    }

    if (animalId) {
      where.animalId = animalId
    }

    const posts = await prisma.post.findMany({
      where,
      // ✅ since you use createdAt as the post date:
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        media: true,
      },
    })

    return res.json(posts)
  } catch (err) {
    console.error('[getPublicPosts] error', err)
    return res.status(500).json({
      message: 'Nepodařilo se načíst příspěvky.',
    })
  }
}

/**
 * DELETE /api/posts/:id
 * Only for ADMIN / MODERATOR (enforced in routes via middleware).
 */
export async function deletePost(req: Request, res: Response) {
  const { id } = req.params

  if (!id) {
    return res.status(400).json({ error: 'Missing post id' })
  }

  try {
    await prisma.post.delete({
      where: { id },
    })
    // PostMedia will be deleted automatically thanks to onDelete: Cascade
    return res.json({ ok: true })
  } catch (e: any) {
    console.error('[deletePost] error', e)

    // Prisma "record not found"
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Post not found' })
    }

    return res.status(500).json({ error: 'Failed to delete post' })
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/posts/count-new?animalId=...&since=ISO_DATE               */
/* optional helper endpoint                                           */
/* ------------------------------------------------------------------ */
export const countNewPostsSince = async (req: Request, res: Response) => {
  try {
    const animalId = req.query.animalId as string | undefined
    const since = req.query.since as string | undefined

    if (!animalId || !since) {
      return res.status(400).json({
        message: 'animalId a since jsou povinné.',
      })
    }

    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        message: 'Neplatný formát času since.',
      })
    }

    const count = await prisma.post.count({
      where: {
        animalId,
        active: true,
        // If you use createdAt as post date, consider switching this too:
        createdAt: {
          gt: sinceDate,
        },
      },
    })

    return res.json({ newPosts: count })
  } catch (err) {
    console.error('[countNewPostsSince] error', err)
    return res.status(500).json({
      message: 'Nepodařilo se spočítat nové příspěvky.',
    })
  }
}