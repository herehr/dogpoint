// backend/src/routes/animals.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { ContentStatus, Role } from '@prisma/client'
import { notifyApproversAboutNewAnimal } from '../services/moderationNotifications'
import { notifyAnimalUpdated } from '../services/notifyAnimalUpdated'

const router = Router()

type BodyMedia = { url?: string; typ?: string } | string

function parseGalerie(input: any): Array<{ url: string; typ?: string }> {
  const arr: BodyMedia[] = Array.isArray(input?.galerie)
    ? input.galerie
    : Array.isArray(input?.gallery)
      ? input.gallery
      : []
  return arr
    .map((x) => (typeof x === 'string' ? { url: x } : { url: x?.url, typ: x?.typ }))
    .filter((m): m is { url: string; typ?: string } => !!m.url)
    .map((m) => ({ url: m.url, typ: m.typ ?? 'image' }))
}

function isStaff(role?: Role | string): boolean {
  return role === Role.ADMIN || role === Role.MODERATOR || role === 'ADMIN' || role === 'MODERATOR'
}

function hasOwn(obj: any, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normUrl(u?: string | null): string {
  return String(u || '').split('?')[0]
}

function gallerySignature(g: Array<{ url: string; typ?: string }>): string {
  return g
    .map((m) => `${normUrl(m.url)}|${String(m.typ || 'image').toLowerCase()}`)
    .sort()
    .join(';;')
}

function didMeaningfulChange(before: any, after: any): boolean {
  // compare key public fields + media
  const fields: Array<keyof any> = [
    'name',
    'jmeno',
    'description',
    'popis',
    'charakteristik',
    'birthDate',
    'bornYear',
    'active',
    'main',
  ]

  for (const f of fields) {
    const b = before?.[f]
    const a = after?.[f]
    // normalize dates
    if (b instanceof Date || a instanceof Date) {
      const bt = b ? new Date(b).getTime() : null
      const at = a ? new Date(a).getTime() : null
      if (bt !== at) return true
      continue
    }
    if (String(b ?? '') !== String(a ?? '')) return true
  }

  const bg = Array.isArray(before?.galerie) ? before.galerie : []
  const ag = Array.isArray(after?.galerie) ? after.galerie : []
  if (gallerySignature(bg) !== gallerySignature(ag)) return true

  return false
}

/* =========================
   READ – PUBLIC LIST
   ========================= */

// GET all (public) – only PUBLISHED + active
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const animals = await prisma.animal.findMany({
      where: {
        active: true,
        status: ContentStatus.PUBLISHED,
      },
      orderBy: { id: 'desc' },
      include: {
        galerie: {
          select: { url: true, typ: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    const shaped = animals.map((a) => ({
      ...a,
      main: a.main ?? a.galerie?.[0]?.url ?? null,
    }))
    res.json(shaped)
  } catch (e: any) {
    console.error('GET /api/animals error:', {
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error fetching animals' })
  }
})

/* =========================
   READ – PENDING FOR STAFF
   ========================= */

// MUST be before '/:id'
router.get('/pending', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user as { id: string; role: Role | string } | undefined
  if (!user || !isStaff(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    const animals = await prisma.animal.findMany({
      where: {
        status: ContentStatus.PENDING_REVIEW,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        galerie: {
          select: { url: true, typ: true },
          orderBy: { id: 'asc' },
        },
      },
    })

    const shaped = animals.map((a) => ({
      ...a,
      main: a.main ?? a.galerie?.[0]?.url ?? null,
    }))
    res.json(shaped)
  } catch (e: any) {
    console.error('GET /api/animals/pending error:', {
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error fetching pending animals' })
  }
})

/* =========================
   READ – ONE PUBLIC
   ========================= */

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
    if (!a) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    const shaped = { ...a, main: a.main ?? a.galerie?.[0]?.url ?? null }
    res.json(shaped)
  } catch (e: any) {
    console.error('GET /api/animals/:id error:', {
      id: req.params.id,
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    })
    res.status(500).json({ error: 'Internal error fetching animal' })
  }
})

/* =========================
   CREATE (STAFF)
   ========================= */

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as any
  const media = parseGalerie(body)
  const requestedMain: string | null = body.main ?? null

  const user = (req as any).user as { id: string; role: Role | string } | undefined
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!isStaff(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  if (!body.jmeno && !body.name) {
    res.status(400).json({ error: 'Missing name/jmeno' })
    return
  }

  const isAdmin = user.role === Role.ADMIN || user.role === 'ADMIN'
  const initialStatus = isAdmin ? ContentStatus.PUBLISHED : ContentStatus.PENDING_REVIEW

  const parsedBornYear =
    body.bornYear === null || body.bornYear === undefined || body.bornYear === ''
      ? null
      : Number.isFinite(Number(body.bornYear))
        ? Number(body.bornYear)
        : null

  const parsedBirthDate = body.birthDate ? new Date(body.birthDate) : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.animal.create({
        data: {
          name: body.name ?? null,
          jmeno: body.jmeno ?? body.name ?? 'Bez jména',
          description: body.description ?? null,
          popis: body.popis ?? null,
          charakteristik: body.charakteristik ?? null,
          birthDate: parsedBirthDate,
          bornYear: parsedBornYear,
          active: body.active === undefined ? true : Boolean(body.active),
          main: requestedMain,
          status: initialStatus,
          createdById: user.id,
          approvedById: isAdmin ? user.id : null,
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

    if (!result) {
      res.status(500).json({ error: 'Create failed' })
      return
    }

    if (!isAdmin) {
      notifyApproversAboutNewAnimal(result.id, result.jmeno ?? result.name ?? 'Bez jména', user.id).catch((e) => {
        console.error('[notifyApproversAboutNewAnimal] failed', e?.message)
      })
    }

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
   UPDATE (STAFF)
   ========================= */

router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const body = (req.body || {}) as any
  const media = parseGalerie(body)

  const user = (req as any).user as { id: string; role: Role | string } | undefined
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!isStaff(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const parsedBornYear = hasOwn(body, 'bornYear')
    ? body.bornYear === null || body.bornYear === '' || body.bornYear === undefined
      ? null
      : Number.isFinite(Number(body.bornYear))
        ? Number(body.bornYear)
        : null
    : undefined

  const parsedBirthDate = hasOwn(body, 'birthDate')
    ? body.birthDate
      ? new Date(body.birthDate)
      : null
    : undefined

  try {
    const before = await prisma.animal.findUnique({
      where: { id },
      include: { galerie: { select: { url: true, typ: true }, orderBy: { id: 'asc' } } },
    })
    if (!before) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const hasOwnMain = hasOwn(body, 'main')
    const willReplaceGallery = Array.isArray(body.galerie) || Array.isArray(body.gallery)

    const mainUpdate = hasOwnMain
      ? { main: body.main ?? null }
      : willReplaceGallery && media.length
        ? { main: media[0].url }
        : {}

    const baseUpdate: any = {
      ...(hasOwn(body, 'name') ? { name: body.name ?? null } : {}),
      ...(hasOwn(body, 'jmeno') ? { jmeno: body.jmeno ?? null } : {}),
      ...(hasOwn(body, 'description') ? { description: body.description ?? null } : {}),
      ...(hasOwn(body, 'popis') ? { popis: body.popis ?? null } : {}),
      ...(hasOwn(body, 'charakteristik') ? { charakteristik: body.charakteristik ?? null } : {}),
      ...(hasOwn(body, 'birthDate') ? { birthDate: parsedBirthDate } : {}),
      ...(hasOwn(body, 'bornYear') ? { bornYear: parsedBornYear } : {}),
      ...(hasOwn(body, 'active') ? { active: Boolean(body.active) } : {}),
      ...mainUpdate,
    }

    let after: any = null

    if (willReplaceGallery) {
      after = await prisma.$transaction(async (tx) => {
        await tx.animal.update({ where: { id }, data: baseUpdate })
        await tx.galerieMedia.deleteMany({ where: { animalId: id } })

        if (media.length) {
          await tx.galerieMedia.createMany({
            data: media.map((g) => ({
              animalId: id,
              url: g.url,
              typ: g.typ ?? 'image',
            })),
          })
        }

        const fresh = await tx.animal.findUnique({
          where: { id },
          include: { galerie: { select: { url: true, typ: true }, orderBy: { id: 'asc' } } },
        })
        if (!fresh) return null
        return { ...fresh, main: fresh.main ?? fresh.galerie[0]?.url ?? null }
      })
    } else {
      const updated = await prisma.animal.update({
        where: { id },
        data: baseUpdate,
        include: { galerie: { select: { url: true, typ: true }, orderBy: { id: 'asc' } } },
      })
      after = { ...updated, main: updated.main ?? updated.galerie[0]?.url ?? null }
    }

    if (!after) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    // ✅ trigger "animal updated" only when meaningful change, and only for visible animals
    const changed = didMeaningfulChange(before, after)
    const shouldNotify = changed && after.status === ContentStatus.PUBLISHED && after.active === true

    if (shouldNotify) {
      try {
        const r = await notifyAnimalUpdated(id, { sendEmail: true })
        console.log('[notifyAnimalUpdated] result', { animalId: id, ...r })
      } catch (e) {
        console.warn('[notifyAnimalUpdated] failed', e)
      }
    }

    res.json(after)
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
   DELETE (soft) – STAFF
   ========================= */

router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user as { id: string; role: Role | string } | undefined
  if (!user || !isStaff(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const id = String(req.params.id)

  try {
    await prisma.animal.update({
      where: { id },
      data: { active: false },
    })

    res.status(204).end()
  } catch (e: any) {
    if (e.code === 'P2025') {
      console.warn('DELETE /api/animals/:id not found', { id })
      res.status(404).json({ error: 'Not found' })
      return
    }

    console.error('DELETE /api/animals/:id error:', e)
    res.status(500).json({ error: 'Internal error deleting animal' })
  }
})

export default router