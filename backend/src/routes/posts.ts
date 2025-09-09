// backend/src/routes/posts.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuthOptional } from '../middleware/auth' // or './authJwt' if you didn't keep the proxy

const router = Router()

type BodyMedia = { url?: string; typ?: string } | string

function parseMedia(input: any): Array<{ url: string; typ?: string }> {
  const arr: BodyMedia[] = Array.isArray(input?.media) ? input.media : []
  return arr
    .map((x) => (typeof x === 'string' ? { url: x } : { url: x?.url, typ: x?.typ }))
    .filter((m): m is { url: string; typ?: string } => !!m.url)
    .map((m) => ({ url: m.url, typ: m.typ ?? 'image' }))
}

/**
 * GET /api/posts?animalId=xxx
 * Public feed of active posts. If animalId provided, filter to that animal.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const animalId = (req.query.animalId as string | undefined) || undefined
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

/**
 * POST /api/posts
 * Body: { animalId: string; title: string; body?: string; media?: (string|{url,typ})[] }
 * Auth optional: if token present, authorId is recorded.
 * (You can switch to strict auth later.)
 */
router.post('/', requireAuthOptional, async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, title, body } = (req.body || {}) as {
      animalId?: string
      title?: string
      body?: string
      media?: BodyMedia[]
    }

    if (!animalId || !title?.trim()) {
      res.status(400).json({ error: 'Missing animalId or title' })
      return
    }

    // ensure animal exists
    const animal = await prisma.animal.findUnique({ where: { id: animalId } })
    if (!animal) {
      res.status(404).json({ error: 'Animal not found' })
      return
    }

    const media = parseMedia(req.body)
    const authorId = req.user?.id // set if caller is authenticated

    const created = await prisma.post.create({
      data: {
        animalId,
        title: title.trim(),
        body: body?.trim() || null,
        authorId: authorId ?? null,
        active: true,
        ...(media.length
          ? {
              media: {
                create: media.map((m) => ({ url: m.url, typ: m.typ ?? 'image' })),
              },
            }
          : {}),
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