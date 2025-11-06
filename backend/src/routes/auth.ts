// backend/src/routes/auth.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { registerAfterPayment } from '../controllers/authExtra'

const router = Router()

function signToken(user: { id: string; role: 'ADMIN' | 'MODERATOR' | 'USER'; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const secret: Secret = rawSecret
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, options)
}

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, route: '/api/auth/*' })
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return }

    const hash = user.passwordHash ?? null
    if (!hash) {
      res.status(409).json({ error: 'PASSWORD_NOT_SET' })
      return
    }

    const ok = await bcrypt.compare(password, hash)
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return }

    const token = signToken({ id: user.id, role: user.role as any, email: user.email })
    res.json({ token, role: user.role })
  } catch (e: any) {
    console.error('Auth login error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * First-time password setup — allowed ONLY if the user exists and has no password yet.
 * POST /api/auth/set-password-first-time { email, password }
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

    const token = signToken({ id: updated.id, role: updated.role as any, email: updated.email })
    res.json({ ok: true, token, role: updated.role })
  } catch (e: any) {
    console.error('set-password-first-time error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/**
 * Register or complete user AFTER successful payment.
 * POST /api/auth/register-after-payment { email, password, name? }
 */
router.post('/register-after-payment', registerAfterPayment) // ← ADD THIS LINE

export default router