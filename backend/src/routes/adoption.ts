// backend/src/routes/adoption.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { requireAuth, requireAuthOptional } from '../middleware/authJwt'

const router = Router()

/**
 * Helper: sign JWT for a user
 */
function signToken(user: { id: string; role: 'ADMIN' | 'MODERATOR' | 'USER'; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const secret: Secret = rawSecret
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, options)
}

/**
 * POST /api/adoption/start
 * Body: { animalId, email, name?, monthly?, password? }
 */
// backend/src/routes/adoption.ts (only the /start route block changed)
router.post('/start', requireAuthOptional, async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, email, name, monthly } = (req.body || {}) as {
      animalId?: string
      email?: string
      name?: string
      monthly?: number
    }

    if (!animalId) { res.status(400).json({ error: 'animalId required' }); return }

    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) } })
    if (!animal) { res.status(404).json({ error: 'Animal not found' }); return }

    // If client is already authenticated, prefer that user; else require email
    let userIdFromToken: string | null = null
    try { userIdFromToken = (req as any)?.user?.id ?? null } catch {}
    let user = userIdFromToken
      ? await prisma.user.findUnique({ where: { id: userIdFromToken } })
      : undefined

    if (!user) {
      if (!email) { res.status(400).json({ error: 'email required' }); return }
      user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        user = await prisma.user.create({
          data: { email: email!, passwordHash: null, role: 'USER' },
        })
      }
    }

    // Create + auto-approve adoption request (DEMO)
    await prisma.adoptionRequest.create({
      data: {
        animalId: animal.id,
        name: name || 'Adoptující',
        email: user.email,
        message: monthly ? `MONTHLY=${monthly}` : null,
        status: 'APPROVED',
      },
    })

    // Issue a JWT (role USER)
    const token = signToken({ id: user.id, role: user.role as any, email: user.email })

    // tell FE if the user has a password already
    const userHasPassword = !!user.passwordHash

    res.json({ ok: true, token, access: { [animal.id]: true }, userHasPassword })
  } catch (e: any) {
    console.error('POST /api/adoption/start error:', { message: e?.message, code: e?.code, stack: e?.stack })
    res.status(500).json({ error: 'Internal error starting adoption' })
  }
})

/**
 * GET /api/adoption/access/:animalId
 */
router.get('/access/:animalId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const animalId = String(req.params.animalId || '')
    if (!animalId) { res.status(400).json({ access: false, error: 'animalId required' }); return }

    const user = await prisma.user.findUnique({ where: { id: String(req.user!.id) } })
    if (!user) { res.status(401).json({ access: false, error: 'user not found' }); return }

    const approved = await prisma.adoptionRequest.findFirst({
      where: { animalId, email: user.email, status: 'APPROVED' },
      select: { id: true },
    })

    res.json({ access: !!approved })
  } catch (e: any) {
    console.error('GET /api/adoption/access/:animalId error:', e)
    res.status(500).json({ access: false, error: 'Internal error' })
  }
})

/**
 * Helper to compute latest activity for an animal
 */
async function latestActivityTsForAnimal(animalId: string): Promise<Date> {
  // Optional models: if not in client (no migration), skip them safely
  const Post = (prisma as any).post
  const PostMedia = (prisma as any).postMedia

  const queries: Array<Promise<{ createdAt: Date } | null>> = []

  if (Post?.findFirst) {
    queries.push(Post.findFirst({
      where: { animalId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }))
  } else {
    queries.push(Promise.resolve(null))
  }

  if (PostMedia?.findFirst) {
    queries.push(PostMedia.findFirst({
      where: { post: { animalId } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }))
  } else {
    queries.push(Promise.resolve(null))
  }

  // GalerieMedia & Animal always exist in your schema
  const gmediaP = prisma.galerieMedia.findFirst({
    where: { animalId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })

  const animalP = prisma.animal.findUnique({
    where: { id: animalId },
    select: { updatedAt: true, createdAt: true },
  })

  const [post, pmedia, gmedia, animal] = await Promise.all([queries[0], queries[1], gmediaP, animalP])

  const dates = [
    post?.createdAt ?? null,
    pmedia?.createdAt ?? null,
    gmedia?.createdAt ?? null,
    (animal?.updatedAt ?? animal?.createdAt) ?? null,
  ].filter(Boolean) as Date[]

  return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date(0)
}

/**
 * GET /api/adoption/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.user!.id) },
      select: { id: true, email: true, role: true },
    })
    if (!user) { res.status(401).json({ error: 'user not found' }); return }

    const approved = await prisma.adoptionRequest.findMany({
      where: { email: user.email, status: 'APPROVED' },
      select: { animalId: true },
    })

    const accessMap = approved.reduce<Record<string, boolean>>((acc, r) => {
      acc[r.animalId] = true
      return acc
    }, {})

    res.json({ ok: true, user, access: accessMap })
  } catch (e: any) {
    console.error('GET /api/adoption/me error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

// List all active adoptions for current user with "hasNew" badge calculation
router.get('/my-animals', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!me) return res.status(401).json({ error: 'user not found' })

    // Only active (not ended) and approved adoptions
    const adoptions = await prisma.adoptionRequest.findMany({
      where: { email: me.email, status: 'APPROVED', endedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, animalId: true, lastSeenAt: true, monthly: true },
    })

    if (adoptions.length === 0) {
      return res.json([]) // nothing adopted yet
    }

    const animals = await prisma.animal.findMany({
      where: { id: { in: adoptions.map(a => a.animalId) } },
      include: { galerie: true },
    })

    // shape & compute hasNew
    const rows = await Promise.all(adoptions.map(async (a) => {
      const an = animals.find(x => x.id === a.animalId)
      if (!an) return null
      const latest = await latestActivityTsForAnimal(an.id)
      const lastSeen = a.lastSeenAt ?? new Date(0)
      return {
        animal: {
          id: an.id,
          jmeno: an.jmeno ?? an.name ?? '',
          main: an.main ?? an.galerie[0]?.url ?? null,
          active: an.active,
        },
        monthly: a.monthly ?? null,
        hasNew: latest.getTime() > lastSeen.getTime(),
        latestAt: latest,
        lastSeenAt: a.lastSeenAt ?? null,
      }
    }))

    res.json(rows.filter(Boolean))
  } catch (e: any) {
    console.error('GET /api/adoption/my-animals error:', {
      message: e?.message, code: e?.code, stack: e?.stack
    })
    res.status(500).json({ error: 'Internal error' })
  }
})

router.post('/seen', requireAuth, async (req, res) => {
  try {
    const { animalId } = req.body as { animalId?: string }
    if (!animalId) return res.status(400).json({ error: 'animalId required' })

    const me = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!me) return res.status(401).json({ error: 'user not found' })

    const ar = await prisma.adoptionRequest.findFirst({
      where: { email: me.email, animalId, status: 'APPROVED', endedAt: null },
      select: { id: true }
    })
    if (!ar) return res.status(404).json({ error: 'adoption not found' })

    await prisma.adoptionRequest.update({
      where: { id: ar.id },
      data: { lastSeenAt: new Date() }
    })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

router.post('/end', requireAuth, async (req, res) => {
  try {
    const { animalId } = req.body as { animalId?: string }
    if (!animalId) return res.status(400).json({ error: 'animalId required' })

    const me = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!me) return res.status(401).json({ error: 'user not found' })

    const ar = await prisma.adoptionRequest.findFirst({
      where: { email: me.email, animalId, status: 'APPROVED', endedAt: null },
      select: { id: true }
    })
    if (!ar) return res.status(404).json({ error: 'adoption not found' })

    await prisma.adoptionRequest.update({
      where: { id: ar.id },
      data: { endedAt: new Date(), status: 'ENDED' }
    })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router