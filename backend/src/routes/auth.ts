// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'

const router = Router()

// Small helpers
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || ''
  if (!secret) throw new Error('Server misconfigured: JWT_SECRET missing')
  return secret
}
function signAuthToken(user: { id: string; role: 'ADMIN'|'MODERATOR'|'USER'; email: string }) {
  const secret = getJwtSecret()
  const expiresIn = process.env.JWT_EXPIRES || '7d'
  // include id in payload (so authJwt can read decoded.id) and set subject too
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    secret,
    { expiresIn, subject: user.id }
  )
}

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, route: '/api/auth/*' })
})

/**
 * POST /api/auth/login
 * Body: { email, password }
 * → { token, role }
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return }

    const stored = (user as any).passwordHash ?? (user as any).password
    if (!stored) { res.status(500).json({ error: 'User has no password set' }); return }

    const ok = await bcrypt.compare(password, stored)
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return }

    const token = signAuthToken({ id: user.id, role: user.role as any, email: user.email })
    res.json({ token, role: user.role })
  } catch (e: any) {
    console.error('POST /api/auth/login error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/forgot
 * Body: { email }
 * → { ok }  (DEV also returns { resetToken } for convenience)
 *
 * In production, email the token link instead of returning it.
 */
router.post('/forgot', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = (req.body || {}) as { email?: string }
    if (!email) { res.status(400).json({ error: 'email required' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    // Always return { ok: true } so we don't leak which emails exist.
    if (!user) { res.json({ ok: true }); return }

    const secret = getJwtSecret()
    const resetToken = jwt.sign(
      { sub: user.id, purpose: 'reset' },
      secret,
      { expiresIn: '30m' }
    )

    // DEV: return token so you can test without an email service.
    // Remove `resetToken` from the response once email sending is wired.
    res.json({ ok: true, resetToken })
  } catch (e: any) {
    console.error('POST /api/auth/forgot error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * POST /api/auth/reset
 * Body: { token, newPassword }
 * → { ok: true }
 */
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = (req.body || {}) as { token?: string; newPassword?: string }
    if (!token) { res.status(400).json({ error: 'token required' }); return }
    if (!newPassword || !newPassword.trim()) { res.status(400).json({ error: 'newPassword required' }); return }

    const secret = getJwtSecret()
    let decoded: any
    try {
      decoded = jwt.verify(token, secret)
    } catch {
      res.status(400).json({ error: 'invalid or expired token' })
      return
    }

    if (decoded?.purpose !== 'reset' || !decoded?.sub) {
      res.status(400).json({ error: 'invalid token payload' })
      return
    }

    const hash = await bcrypt.hash(newPassword.trim(), 10)
    await prisma.user.update({
      where: { id: String(decoded.sub) },
      data: { passwordHash: hash },
    })

    res.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/auth/reset error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router