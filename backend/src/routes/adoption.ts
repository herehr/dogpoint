// backend/src/routes/adoption.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt' // req.user = { id, role }

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
router.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, email, name, monthly, password } = (req.body || {}) as {
      animalId?: string
      email?: string
      name?: string
      monthly?: number
      password?: string
    }

    if (!animalId) { res.status(400).json({ error: 'animalId required' }); return }
    if (!email) { res.status(400).json({ error: 'email required' }); return }

    // Ensure animal exists
    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) } })
    if (!animal) { res.status(404).json({ error: 'Animal not found' }); return }

    // Find or create user by email
    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      let passwordHash: string | null = null
      if (password && password.length >= 6) {
        passwordHash = await bcrypt.hash(password, 10)
      }
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'USER',
        },
      })
    } else if (password && password.length >= 6 && !user.passwordHash) {
      // Upgrade existing user with password if missing
      const hash = await bcrypt.hash(password, 10)
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      })
    }

    // Create adoption request (auto-approved in DEMO)
    await prisma.adoptionRequest.create({
      data: {
        animalId: animal.id,
        name: name || 'Adoptující',
        email,
        message: monthly ? `MONTHLY=${monthly}` : null,
        status: 'APPROVED',
      },
    })

    // Issue a JWT
    const token = signToken({ id: user.id, role: user.role as any, email: user.email })

    res.json({ ok: true, token, access: { [animal.id]: true } })
  } catch (e: any) {
    console.error('POST /api/adoption/start error:', e)
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

export default router