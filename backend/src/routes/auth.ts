// backend/src/routes/auth.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { Role } from '@prisma/client'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

const router = Router()

function signToken(user: { id: string; role: Role | string; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, rawSecret as Secret, options)
}

/**
 * GET /api/auth/me
 * Returns basic user + all subscription animalIds (ACTIVE + PENDING)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const hdr = req.headers.authorization || ''
    const m = hdr.match(/^Bearer\s+(.+)$/i)
    if (!m) return res.status(401).json({ error: 'Unauthorized' })

    const payload = jwt.verify(m[1], process.env.JWT_SECRET as Secret) as any
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, email: true, role: true },
    })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const subs = await prisma.subscription.findMany({
      where: { userId: user.id },
      select: { animalId: true },
    })

    res.json({ ...user, animals: subs.map(s => s.animalId), subscriptions: subs })
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' })
  }
})

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.passwordHash) return res.status(409).json({ error: 'PASSWORD_NOT_SET' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    // Link pledges to subscriptions/payments for this user
    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ token, role: user.role })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/set-password-first-time
 * body: { email, password }
 */
router.post('/set-password-first-time', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.passwordHash) return res.status(409).json({ error: 'PASSWORD_ALREADY_SET' })

    const passwordHash = await bcrypt.hash(password, 10)
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    // Link pledges for this user
    await linkPaidOrRecentPledgesToUser(updated.id, updated.email)

    const token = signToken({ id: updated.id, role: updated.role, email: updated.email })
    res.json({ ok: true, token, role: updated.role })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/register-after-payment
 * body: { email, password }
 */
router.post('/register-after-payment', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })

    const passwordHash = await bcrypt.hash(password, 10)

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({ data: { email, passwordHash, role: Role.USER } })
    } else if (!user.passwordHash) {
      user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    }

    // Link pledges for this user
    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/claim-paid
 * body: { email, sessionId? }
 * Ensures pledges are linked immediately after redirect.
 */
router.post('/claim-paid', async (req: Request, res: Response) => {
  try {
    const { email, sessionId } = (req.body || {}) as { email?: string; sessionId?: string }
    if (!email) return res.status(400).json({ error: 'Missing email' })

    if (sessionId) {
      await prisma.pledge.updateMany({
        where: { providerId: sessionId },
        data: { email },
      })
    }

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({ data: { email, role: Role.USER } })
    }

    // IMPORTANT: use canonical DB email
    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/debug-backfill-adoptions
 * body: { email }
 *
 * One-time helper to backfill Subscriptions from existing Pledges
 * for a given user email. REMOVE this route after you’ve used it.
 */
router.post('/debug-backfill-adoptions', async (req: Request, res: Response) => {
  try {
    const { email } = (req.body || {}) as { email?: string }
    if (!email) {
      return res.status(400).json({ error: 'Missing email' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Big grace window so older pledges are included (approx 1 year)
    const result = await linkPaidOrRecentPledgesToUser(user.id, user.email, {
      graceMinutes: 60 * 24 * 365,
    })

    return res.json({
      ok: true,
      processed: result.processed,
    })
  } catch (e) {
    console.error('[debug-backfill-adoptions] error:', e)
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router