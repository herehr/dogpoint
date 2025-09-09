// backend/src/routes/posts.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuthOptional } from '../middleware/auth' // we’ll allow public GET
import { requireAuth } from '../middleware/auth'         // POST needs auth (admin/mod)

const router = Router()

// Health/ping
router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, route: '/api/posts/*' })
})

// List public posts (optionally by animalId)
router.get('/', requireAuthOptional, async (req: Request, res: Response) => {
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
    res.json(posts)
  } catch (e: any) {
    console.error('GET /api/posts error:', e)
    res.status(500).json({ error: 'Internal error fetching posts' })
  }
})

// Create a post (admin/moderator)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { animalId, title, body, media } = (req.body || {}) as {
      animalId?: string
      title?: string
      body?: string
      media?: Array<{ url: string; typ?: string }> | string[]
    }

    if (!animalId) { res.status(400).json({ error: 'animalId required' }); return }
    if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return }

    const normalizedMedia =
      Array.isArray(media)
        ? media
            .map((m) => (typeof m === 'string' ? { url: m, typ: 'image' } : { url: m?.url, typ: m?.typ ?? 'image' }))
            .filter((m) => !!m.url)
        : []

    const created = await prisma.post.create({
      data: {
        animalId,
        title: title.trim(),
        body: body?.trim() ?? null,
        active: true,
        media: normalizedMedia.length
          ? {
              create: normalizedMedia.map((m) => ({ url: m.url, typ: m.typ ?? 'image' })),
            }
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