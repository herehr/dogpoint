// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'

// Helper: issue a JWT for frontend session
function signUserToken(payload: { id: string; role: 'USER' | 'MODERATOR' | 'ADMIN' }) {
  const secret = process.env.JWT_SECRET || ''
  if (!secret) throw new Error('JWT_SECRET missing')
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

const router = Router()

/**
 * POST /api/adoption/start
 * Body: { animalId: string, email: string, name?: string, monthly?: number }
 * Demo behavior:
 *  - creates/ensures a USER by email
 *  - creates an AdoptionRequest with status ACTIVE
 *  - returns a JWT so the user is “logged in”
 *  - returns access map for the adopted animal
 */
router.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, email, name, monthly } = (req.body || {}) as {
      animalId?: string
      email?: string
      name?: string
      monthly?: number
    }

    if (!animalId) { res.status(400).json({ error: 'animalId required' }); return }
    if (!email)     { res.status(400).json({ error: 'email required' }); return }

    // Ensure animal exists
    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) } })
    if (!animal) { res.status(404).json({ error: 'animal not found' }); return }

    // Upsert user by email as USER
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), role: 'USER' },
      update: {},
    })

    // Create ACTIVE adoption request (demo)
    await prisma.adoptionRequest.create({
      data: {
        animalId: animal.id,
        name: name || 'Adoptující',
        email: email.toLowerCase(),
        message: monthly ? `Měsíčně: ${monthly} Kč (DEMO)` : null,
        status: 'ACTIVE',
      },
    })

    const token = signUserToken({ id: user.id, role: 'USER' })
    res.json({ ok: true, token, access: { [animal.id]: true } })
  } catch (e: any) {
    console.error('POST /api/adoption/start error:', e?.message || e)
    res.status(500).json({ error: 'startAdoption: internal error' })
  }
})

/**
 * GET /api/adoption/access/:animalId
 * Returns { access: boolean } for the current session’s token.
 * - ADMIN/MODERATOR → always true
 * - USER → true if an ACTIVE AdoptionRequest exists for that email/animal
 * - No token → false
 */
router.get('/access/:animalId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId } = req.params
    if (!animalId) { res.status(400).json({ access: false, error: 'animalId required' }); return }

    // Try to read auth token (optional)
    const auth = req.headers.authorization || ''
    const [, token] = auth.split(' ')
    let role: 'USER' | 'MODERATOR' | 'ADMIN' | null = null
    let userId: string | null = null

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET)
        role = decoded?.role || null
        userId = decoded?.id || decoded?.sub || null
      } catch {
        // ignore invalid token → access remains false for anonymous
      }
    }

    if (role === 'ADMIN' || role === 'MODERATOR') {
      res.json({ access: true }); return
    }

    if (role === 'USER' && userId) {
      // Find the user and check if an ACTIVE request exists for this animal
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user?.email) { res.json({ access: false }); return }

      const reqActive = await prisma.adoptionRequest.findFirst({
        where: {
          animalId: String(animalId),
          email: user.email.toLowerCase(),
          status: 'ACTIVE',
        },
      })
      res.json({ access: !!reqActive })
      return
    }

    res.json({ access: false })
  } catch (e: any) {
    console.error('GET /api/adoption/access error:', e?.message || e)
    res.status(500).json({ access: false })
  }
})

export default router