// backend/src/routes/posts.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuthOptional, AuthedRequest } from '../middleware/auth'

const router = Router()

/**
 * List posts (public). Optional filter by animalId: GET /api/posts?animalId=ID
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId } = req.query as { animalId?: string }
    const posts = await prisma.post.findMany({
      where: animalId ? { animalId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { media: true },
    })
    res.json(posts)
  } catch (e: any) {
    console.error('GET /api/posts error:', e)
    res.status(500).json({ error: 'Internal error fetching posts' })
  }
})

/**
 * Create a post (author optional).
 * Body: { animalId: string, title: string, body?: string, media?: Array<{url:string, typ?: "image"|"video"}> }
 */
router.post('/', requireAuthOptional, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body || {}) as {
      animalId?: string
      title?: string
      body?: string
      media?: Array<{ url?: string; typ?: string }> | string[]
    }

    if (!body.animalId || !body.title) {
      res.status(400).json({ error: 'animalId and title are required' })
      return
    }

    // Normalize media
    const mediaItems =
      Array.isArray(body.media)
        ? body.media
            .map((m) => (typeof m === 'string' ? { url: m } : { url: m?.url, typ: m?.typ }))
            .filter((m): m is { url: string; typ?: string } => !!m.url)
            .map((m) => ({ url: m.url, typ: m.typ ?? 'image' }))
        : []

    const authed = req as AuthedRequest
    const authorId = authed.user?.sub || null

    const created = await prisma.post.create({
      data: {
        animalId: body.animalId,
        title: body.title,
        body: body.body ?? null,
        active: true,
        authorId: authorId ?? undefined,
        media: mediaItems.length
          ? { create: mediaItems.map((m) => ({ url: m.url, typ: m.typ ?? 'image' })) }
          : undefined,
      },
      include: { media: true },
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

export default router