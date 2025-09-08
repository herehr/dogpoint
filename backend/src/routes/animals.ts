// backend/src/routes/animals.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

type BodyMedia = { url?: string; typ?: string } | string

function parseGalerie(input: any): Array<{ url: string; typ?: string }> {
  const arr: BodyMedia[] =
    Array.isArray(input?.galerie) ? input.galerie :
    Array.isArray(input?.gallery) ? input.gallery :
    []
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
      orderBy: { createdAt: 'desc' },
      include: { galerie: true },
    })
    // If you want to expose a computed "main" to clients without DB column:
    // const shaped = animals.map(a => ({ ...a, main: a.galerie[0]?.url ?? null }))
    // res.json(shaped)
    res.json(animals)
  } catch (e: any) {
    console.error('GET /api/animals error:', e)
    res.status(500).json({ error: 'Internal error fetching animals' })
  }
})

// GET one (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const a = await prisma.animal.findUnique({
      where: { id: String(req.params.id) },
      include: { galerie: true },
    })
    if (!a) { res.status(404).json({ error: 'Not found' }); return }
    // const shaped = { ...a, main: a.galerie[0]?.url ?? null }
    // res.json(shaped)
    res.json(a)
  } catch (e: any) {
    console.error('GET /api/animals/:id error:', e)
    res.status(500).json({ error: 'Internal error fetching animal' })
  }
})

/* =========================
   CREATE
   ========================= */

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body || {}) as any
    const media = parseGalerie(body)

    const created = await prisma.animal.create({
      data: {
        name: body.name,
        jmeno: body.jmeno,
        description: body.description,
        popis: body.popis,
        active: Boolean(body.active),
        // If you later add vek/druh columns, uncomment:
        // vek: body.vek ?? null,
        // druh: body.druh ?? null,
        galerie: media.length
          ? { create: media.map((g) => ({ url: g.url, typ: g.typ ?? 'image' })) }
          : undefined,
      },
      include: { galerie: true },
    })
    res.status(201).json(created)
  } catch (e: any) {
    console.error('POST /api/animals error:', e)
    res.status(500).json({ error: 'Internal error creating animal' })
  }
})

/* =========================
   UPDATE  (replace gallery only if provided)
   ========================= */

router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const body = (req.body || {}) as any
  const media = parseGalerie(body)

  try {
    const baseUpdate: any = {
      name: body.name,
      jmeno: body.jmeno,
      description: body.description,
      popis: body.popis,
      active: body.active,
      // vek: body.vek,
      // druh: body.druh,
    }

    // If gallery provided, replace it in a transaction
    if (Array.isArray(body.galerie) || Array.isArray(body.gallery)) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.galerieMedia.deleteMany({ where: { animalId: id } })
        const upd = await tx.animal.update({
          where: { id },
          data: baseUpdate,
          include: { galerie: true },
        })
        if (media.length) {
          await tx.galerieMedia.createMany({
            data: media.map((g) => ({ animalId: id, url: g.url, typ: g.typ ?? 'image' })),
          })
        }
        return tx.animal.findUnique({
          where: { id },
          include: { galerie: true },
        })
      })
      res.json(updated)
      return
    }

    // No gallery changes → simple update
    const updated = await prisma.animal.update({
      where: { id },
      data: baseUpdate,
      include: { galerie: true },
    })
    res.json(updated)
  } catch (e: any) {
    console.error('PATCH /api/animals/:id error:', e)
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