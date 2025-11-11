// backend/src/routes/auth.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { Role, SubscriptionStatus } from '@prisma/client'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

const router = Router()

// ---------- helpers ----------
function signToken(user: { id: string; role: Role; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const secret: Secret = rawSecret
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, options)
}

function verifyBearer(req: Request) {
  try {
    const hdr = req.headers.authorization || ''
    const m = hdr.match(/^Bearer\s+(.+)$/i)
    if (!m) return null
    const token = m[1]
    const rawSecret = process.env.JWT_SECRET
    if (!rawSecret) return null
    const payload = jwt.verify(token, rawSecret) as any
    return payload ?? null
  } catch {
    return null
  }
}

// ---------- routes ----------

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, route: '/api/auth/*' })
})

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 */
router.get('/me', async (req: Request, res: Response) => {
  const payload = verifyBearer(req)
  if (!payload?.sub) return res.status(401).json({ error: 'Unauthorized' })

  const user = await prisma.user.findUnique({
    where: { id: String(payload.sub) },
    select: { id: true, email: true, role: true },
  })
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Optional: snapshot of active adoptions
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { animalId: true },
  })

  res.json({ ...user, animals: subs.map(s => s.animalId) })
})

/**
 * POST /api/auth/login
 * body: { email, password }
 * - If user has no password yet -> 409 PASSWORD_NOT_SET
 * - On success, also links PAID or recent PENDING pledges (provisional access)
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return }

    const hash = user.passwordHash ?? null
    if (!hash) { res.status(409).json({ error: 'PASSWORD_NOT_SET' }); return }

    const ok = await bcrypt.compare(password, hash)
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return }

    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ token, role: user.role })
  } catch (e: any) {
    console.error('Auth login error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/set-password-first-time
 * body: { email, password }
 * - Allowed only when user exists and has NO password yet
 * - Also links pledges afterwards (provisional access)
 */
router.post('/set-password-first-time', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }
    if (password.length < 6) { res.status(400).json({ error: 'Password too short' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    if (user.passwordHash) { res.status(409).json({ error: 'PASSWORD_ALREADY_SET' }); return }

    const hash = await bcrypt.hash(password, 10)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    })

    await linkPaidOrRecentPledgesToUser(updated.id, updated.email)

    const token = signToken({ id: updated.id, role: updated.role, email: updated.email })
    res.json({ ok: true, token, role: updated.role })
  } catch (e: any) {
    console.error('set-password-first-time error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/claim-paid
 * body: { email }
 * - Passwordless login immediately after Stripe success redirect.
 * - Ensures user exists, links PAID (or recent PENDING) pledges, verifies ACTIVE subscription, returns JWT.
 */
router.post('/claim-paid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = (req.body || {}) as { email?: string }
    if (!email) { res.status(400).json({ error: 'Missing email' }); return }

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, role: Role.USER }, // passwordHash stays null
      })
    }

    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('claim-paid error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

    // 4) mint token
    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('[auth claim-paid] error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/register-after-payment
 * body: { email, password, name? }
 * - Optional path if you do want to let donor set a password after payment.
 * - Creates the user or sets first password.
 * - Links pledges (PAID or recent PENDING) → active subscription.
 * - Returns JWT token.
 */
router.post('/register-after-payment', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string; name?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }
    if (password.length < 6) { res.status(400).json({ error: 'Password too short' }); return }

    const hash = await bcrypt.hash(password, 10)

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, passwordHash: hash, role: Role.USER },
      })
    } else if (!user.passwordHash) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      })
    }

    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('register-after-payment error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router