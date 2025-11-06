// backend/src/routes/auth.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { linkPaidPledgesToUser } from '../controllers/authExtra'
import { Role } from '@prisma/client'

const router = Router()

function signToken(user: { id: string; role: Role; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const secret: Secret = rawSecret
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, options)
}

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, route: '/api/auth/*' })
})

/**
 * POST /api/auth/login
 * body: { email, password }
 * - If user has no password yet -> 409 PASSWORD_NOT_SET
 * - On success, also links any PAID pledges (by email) into subscriptions + initial payment
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return }

    const hash = user.passwordHash ?? null
    if (!hash) {
      // user exists but has no password yet → frontend should call /set-password-first-time
      res.status(409).json({ error: 'PASSWORD_NOT_SET' })
      return
    }

    const ok = await bcrypt.compare(password, hash)
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return }

    // Convert/link paid pledges for this email on every successful login
    await linkPaidPledgesToUser(user.id, user.email)

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
 * - Also links paid pledges afterwards
 */
router.post('/set-password-first-time', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }
    if (password.length < 6) { res.status(400).json({ error: 'Password too short' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    if (user.passwordHash) {
      res.status(409).json({ error: 'PASSWORD_ALREADY_SET' })
      return
    }

    const hash = await bcrypt.hash(password, 10)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    })

    // Link pledges after initial password set
    await linkPaidPledgesToUser(updated.id, updated.email)

    const token = signToken({ id: updated.id, role: updated.role, email: updated.email })
    res.json({ ok: true, token, role: updated.role })
  } catch (e: any) {
    console.error('set-password-first-time error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/register-after-payment
 * body: { email, password, name? }
 * - Used after Stripe success redirect if the donor didn’t have an account.
 * - Creates the user or sets first password.
 * - Links paid pledges (email) → subscriptions + initial payment.
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
    // If user already had a password, we just proceed to link pledges

    await linkPaidPledgesToUser(user.id, user.email)

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('register-after-payment error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router