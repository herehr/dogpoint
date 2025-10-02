// backend/src/routes/animals.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

type BodyMedia = { url?: string; typ?: string } | string

function parseGalerie(input: any): Array<{ url: string; typ?: string }> {
  const arr: BodyMedia[] =
    Array.isArray(input?.galerie) ? input.galerie
    : Array.isArray(input?.gallery) ? input.gallery
    : []
  return arr
    .map((x) => (typeof x === 'string' ? { url: x } : { url: x?.url, typ: x?.typ }))
    .filter((m): m is { url: string; typ?: string } => !!m.url)
    .map((m) => ({ url: m.url, typ: m.typ ?? 'image' }))
}

/* =========================
   READ
   ========================= */

// GET all (public)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const animals = await prisma.animal.findMany({
      // Use id to avoid schema drift on createdAt
      orderBy: { id: 'desc' },
      // Include only what we need from galerie; order by id to avoid createdAt drift
      include: {
        galerie: {
          select: { url: true, typ: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    const shaped = animals.map(a => ({
      ...a,
      main: a.main ?? a.galerie?.[0]?.url ?? null,
    }))
    res.json(shaped)
  } catch (e: any) {
    console.error('GET /api/animals error:', {
      message: e?.message, code: e?.code, meta: e?.meta, stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error fetching animals' })
  }
})

// GET one (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const a = await prisma.animal.findUnique({
      where: { id: String(req.params.id) },
      include: {
        galerie: {
          select: { url: true, typ: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!a) { res.status(404).json({ error: 'Not found' }); return }
    const shaped = { ...a, main: a.main ?? a.galerie?.[0]?.url ?? null }
    res.json(shaped)
  } catch (e: any) {
    console.error('GET /api/animals/:id error:', {
      id: req.params.id,
      message: e?.message, code: e?.code, meta: e?.meta, stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error fetching animal' })
  }
})

/* =========================
   CREATE (robust: create animal first, then gallery)
   ========================= */

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as any
  const media = parseGalerie(body)
  const requestedMain: string | null = body.main ?? null

  if (!body.jmeno && !body.name) {
    res.status(400).json({ error: 'Missing name/jmeno' }); return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.animal.create({
        data: {
          name: body.name ?? null,
          jmeno: body.jmeno ?? body.name ?? 'Bez jména',
          description: body.description ?? null,
          popis: body.popis ?? null,
          active: body.active === undefined ? true : Boolean(body.active),
          main: requestedMain,
          // vek: body.vek ?? null,
          // druh: body.druh ?? null,
        },
      })

      if (media.length) {
        await tx.galerieMedia.createMany({
          data: media.map((g) => ({
            animalId: created.id,
            url: g.url,
            typ: g.typ ?? 'image',
          })),
        })
      }

      if (!requestedMain && media.length) {
        await tx.animal.update({
          where: { id: created.id },
          data: { main: media[0].url },
        })
      }

      const fresh = await tx.animal.findUnique({
        where: { id: created.id },
        include: { galerie: true },
      })
      if (!fresh) return null
      return { ...fresh, main: fresh.main ?? fresh.galerie[0]?.url ?? null }
    })

    if (!result) { res.status(500).json({ error: 'Create failed' }); return }
    res.status(201).json(result)
  } catch (e: any) {
    console.error('POST /api/animals error:', {
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error creating animal' })
  }
})

/* =========================
   UPDATE (replace gallery only if provided)
   ========================= */

router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const body = (req.body || {}) as any
  const media = parseGalerie(body)

  try {
    const hasOwnMain = Object.prototype.hasOwnProperty.call(body, 'main')
    const willReplaceGallery = Array.isArray(body.galerie) || Array.isArray(body.gallery)
    const mainUpdate =
      hasOwnMain
        ? { main: body.main ?? null }
        : (willReplaceGallery && media.length ? { main: media[0].url } : {})

    const baseUpdate: any = {
      name: body.name ?? undefined,
      jmeno: body.jmeno ?? undefined,
      description: body.description ?? undefined,
      popis: body.popis ?? undefined,
      active: body.active ?? undefined,
      // vek: body.vek ?? undefined,
      // druh: body.druh ?? undefined,
      ...mainUpdate,
    }

    if (willReplaceGallery) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.animal.update({
          where: { id },
          data: baseUpdate,
        })

        await tx.galerieMedia.deleteMany({ where: { animalId: id } })
        if (media.length) {
          await tx.galerieMedia.createMany({
            data: media.map((g) => ({ animalId: id, url: g.url, typ: g.typ ?? 'image' })),
          })
        }

        const fresh = await tx.animal.findUnique({
          where: { id },
          include: { galerie: true },
        })
        if (!fresh) return null
        return { ...fresh, main: fresh.main ?? fresh.galerie[0]?.url ?? null }
      })
      if (!updated) { res.status(404).json({ error: 'Not found' }); return }
      res.json(updated)
      return
    }

    const updated = await prisma.animal.update({
      where: { id },
      data: baseUpdate,
      include: { galerie: true },
    })
    res.json({ ...updated, main: updated.main ?? updated.galerie[0]?.url ?? null })
  } catch (e: any) {
    console.error('PATCH /api/animals/:id error:', {
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error updating animal' })
  }
})

/* =========================
   DELETE
   ========================= */

router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    await prisma.galerieMedia.deleteMany({ where: { animalId: id } })
    await prisma.animal.delete({ where: { id } })
    res.status(204).end()
  } catch (e: any) {
    console.error('DELETE /api/animals/:id error:', e)
    res.status(500).json({ error: 'Internal error deleting animal' })
  }
})

export default router