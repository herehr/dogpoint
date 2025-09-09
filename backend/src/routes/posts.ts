// backend/src/routes/posts.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/auth'

/**
 * Public list of posts (optionally filtered by animalId).
 * GET /api/posts?animalId=xxx
 */
const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const animalId = req.query.animalId ? String(req.query.animalId) : undefined
    const where: any = { active: true }
    if (animalId) where.animalId = animalId

    const posts = await prisma.post.findMany({
      where,
      include: { media: true },
      orderBy: { createdAt: 'desc' },
    })

    res.json(posts)
  } catch (e: any) {
    console.error('GET /api/posts error:', e)
    res.status(500).json({ error: 'Internal error fetching posts' })
  }
})

/**
 * Create a post (Admin/Moderator/User after adoption – for now auth only).
 * Body: { animalId: string, title: string, body?: string, media?: [{url, typ?}] }
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, title, body, media } = (req.body || {}) as {
      animalId?: string
      title?: string
      body?: string
      media?: Array<{ url?: string; typ?: string } | string>
    }

    if (!animalId || !title) {
      res.status(400).json({ error: 'animalId and title are required' })
      return
    }

    const authorId = (req as any).user?.sub ?? (req as any).user?.id ?? null

    // create post
    const created = await prisma.post.create({
      data: {
        animalId,
        title,
        body: body ?? null,
        active: true,
        authorId: authorId ?? undefined,
      },
    })

    // media
    const parsedMedia =
      Array.isArray(media)
        ? media
            .map((m) => (typeof m === 'string' ? { url: m, typ: 'image' } : { url: m?.url, typ: m?.typ ?? 'image' }))
            .filter((m) => !!m.url)
        : []

    if (parsedMedia.length) {
      await prisma.postMedia.createMany({
        data: parsedMedia.map((m) => ({ postId: created.id, url: m.url!, typ: m.typ })),
      })
    }

    const full = await prisma.post.findUnique({
      where: { id: created.id },
      include: { media: true },
    })

    res.status(201).json(full)
  } catch (e: any) {
    console.error('POST /api/posts error:', e)
    res.status(500).json({ error: 'Internal error creating post' })
  }
})

export default router