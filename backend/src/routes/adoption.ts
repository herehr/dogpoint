// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import type { JwtUser } from '../middleware/authJwt'
import { requireAuth as requireAuthJwt } from '../middleware/authJwt'

const router = Router()

// Small helper: sign app JWTs
function signAppToken(payload: { id: string; role: 'ADMIN'|'MODERATOR'|'USER' }) {
  const secret = process.env.JWT_SECRET || ''
  const expiresIn = process.env.JWT_EXPIRES || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

// DEV helper: simple staff check
function isStaff(u?: JwtUser) {
  return !!u && (u.role === 'ADMIN' || u.role === 'MODERATOR')
}

/**
 * POST /api/adoption/start
 * Body: { animalId: string, email: string, name?: string, monthly?: number, password?: string }
 *
 * DEV FLOW:
 * - if user with email exists -> reuse it (if password provided and user has no passwordHash, set it)
 * - else create user(role USER) with password (required if user doesn't exist)
 * - write AdoptionRequest (status NEW)
 * - return { ok: true, token, access: { [animalId]: true } }
 *
 * NOTE: In production you’d integrate payment + email verification here.
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
    if (!email || !String(email).trim()) { res.status(400).json({ error: 'email required' }); return }

    // Ensure the animal exists (nice to have)
    const animal = await prisma.animal.findUnique({ where: { id: String(animalId) } })
    if (!animal) { res.status(404).json({ error: 'animal not found' }); return }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // For new users we require a password (dev: keep it simple)
      if (!password || !password.trim()) {
        res.status(400).json({ error: 'password required for new user' }); return
      }
      const passwordHash = await bcrypt.hash(password, 10)
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'USER',
        },
      })
    } else {
      // Existing user: if they don’t have a passwordHash yet and provided a password, set it
      if (!user.passwordHash && password && password.trim()) {
        const passwordHash = await bcrypt.hash(password.trim(), 10)
        user = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        })
      }
    }

    // Record the adoption request (DEV: we mark NEW; future can move to PAID/ACTIVE after gateway callback)
    await prisma.adoptionRequest.create({
      data: {
        animalId: animal.id,
        name: name?.trim() || email,
        email,
        message: monthly ? `Monthly: ${monthly} CZK` : null,
        status: 'NEW',
      },
    })

    // Issue a token so the user is logged in and can see locked content
    const token = signAppToken({ id: user.id, role: user.role })

    // Return unlocked map for this animal (frontend uses AccessContext locally too)
    res.json({ ok: true, token, access: { [animalId]: true } })
  } catch (e: any) {
    console.error('POST /api/adoption/start error:', e)
    res.status(500).json({ error: 'Internal error starting adoption' })
  }
})

/**
 * GET /api/adoption/access/:animalId
 * DEV policy:
 * - If authenticated user is ADMIN or MODERATOR => access: true
 * - If authenticated role USER => access: true (after /start they will be logged in)
 * - If not authenticated => false
 *
 * (In a fuller implementation you could check AdoptionRequest status/ownership here.)
 */
router.get('/access/:animalId', (req: Request, res: Response): void => {
  try {
    // Try to decode JWT if present; optional auth
    const header = req.headers.authorization || ''
    const [, token] = header.split(' ')
    let user: JwtUser | undefined
    if (token && (process.env.JWT_SECRET || '')) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any
        user = { id: decoded.id || decoded.sub, role: decoded.role }
      } catch {
        // ignore invalid token, treat as anonymous
      }
    }

    const access = !!user // simple: any logged-in user sees their adopted animal posts
    // staff always true, but the line above already yields true for any user;
    // if you want stricter, use: const access = isStaff(user) || !!user

    res.json({ access })
  } catch (e: any) {
    console.error('GET /api/adoption/access/:animalId error:', e)
    res.status(500).json({ error: 'Internal error checking access' })
  }
})

/**
 * Example protected route you might add later:
 * router.get('/my', requireAuthJwt, async (req, res) => { ... })
 */

export default router