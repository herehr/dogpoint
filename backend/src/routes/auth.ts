// backend/src/routes/auth.ts  (final)
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { Role } from '@prisma/client'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'
import { logErr } from '../lib/log'

const router = Router()

function signToken(user: { id: string; role: Role; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, rawSecret as Secret, options)
}

// backend/src/routes/auth.ts  — replace the /me route body
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

    // Return ALL user subscriptions (no status filter)
    const subs = await prisma.subscription.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        animalId: true,
        // keep status if your schema has it; harmless if it doesn't
        // @ts-ignore - optional in some schemas
        status: true as any,
        // include basic animal details so UI can render a card/list
        animal: {
          select: {
            id: true,
            jmeno: true,
            name: true,
            main: true,
          },
        },
      },
      orderBy: { /* show newest first */ /* @ts-ignore */ startedAt: 'desc' as any },
    })

    // back-compat: simple array of animalIds
    const animalIds = subs.map(s => s.animalId)

    // richer list for “Moje adopce” pages
    const animals = subs
      .map(s => s.animal)
      .filter(Boolean)
      .map(a => ({
        id: a!.id,
        title: a!.jmeno || a!.name || '—',
        main: a!.main || null,
      }))

    res.json({
      ...user,
      animals: animalIds,     // old shape (ids)
      myAdoptions: animals,   // new shape (objects ready to render)
      subscriptions: subs,    // full detail if needed
    })
  } catch (e) {
    console.error('/api/auth/me error:', e)
    res.status(401).json({ error: 'Unauthorized' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.passwordHash) return res.status(409).json({ error: 'PASSWORD_NOT_SET' })
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    await linkPaidOrRecentPledgesToUser(user.id, user.email)
    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ token, role: user.role })
  } catch (e) {
    console.error('Auth login error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

router.post('/set-password-first-time', async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.passwordHash) return res.status(409).json({ error: 'PASSWORD_ALREADY_SET' })

    const passwordHash = await bcrypt.hash(password, 10)
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    await linkPaidOrRecentPledgesToUser(updated.id, updated.email)
    const token = signToken({ id: updated.id, role: updated.role, email: updated.email })
    res.json({ ok: true, token, role: updated.role })
  } catch (e) {
    console.error('set-password-first-time error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})


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

    // Best-effort pledge linking — never make the whole request fail
    try {
      const r = await linkPaidOrRecentPledgesToUser(user.id, user.email)
      console.log('[auth.register-after-payment] link result:', r)
    } catch (e) {
      logErr('linkPaidOrRecentPledgesToUser', e)
      // do not throw — proceed to return token
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e) {
    logErr('register-after-payment', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router