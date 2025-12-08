// backend/src/routes/auth.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { prisma } from '../prisma'
import { Role } from '@prisma/client'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

const router = Router()

/* =========================================================
   JWT helper
   ========================================================= */

function signToken(user: { id: string; role: Role | string; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    rawSecret as Secret,
    options,
  )
}

/* =========================================================
   Password reset e-mail config
   ========================================================= */

const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@dog-point.cz'
const APP_BASE_URL =
  process.env.APP_BASE_URL || 'https://patron.dog-point.cz'

const resetTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

/* =========================================================
   GET /api/auth/me
   Returns basic user + subscription animalIds
   ========================================================= */

router.get('/me', async (req: Request, res: Response) => {
  try {
    const hdr = req.headers.authorization || ''
    const m = hdr.match(/^Bearer\s+(.+)$/i)
    if (!m) return res.status(401).json({ error: 'Unauthorized' })

    const payload = jwt.verify(
      m[1],
      process.env.JWT_SECRET as Secret,
    ) as any

    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, email: true, role: true },
    })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const subs = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
      select: { animalId: true },
    })

    res.json({
      ...user,
      animals: subs.map((s) => s.animalId),
      subscriptions: subs,
    })
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' })
  }
})

/* =========================================================
   POST /api/auth/login
   body: { email, password }
   ========================================================= */

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as {
      email?: string
      password?: string
    }
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.passwordHash) {
      return res.status(409).json({ error: 'PASSWORD_NOT_SET' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    // Link pledges to subscriptions/payments for this user
    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({
      id: user.id,
      role: user.role,
      email: user.email,
    })
    res.json({ token, role: user.role })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/set-password-first-time
   body: { email, password }
   ========================================================= */

router.post(
  '/set-password-first-time',
  async (req: Request, res: Response) => {
    try {
      const { email, password } = (req.body || {}) as {
        email?: string
        password?: string
      }
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: 'Missing email or password' })
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password too short' })
      }

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) return res.status(404).json({ error: 'User not found' })
      if (user.passwordHash) {
        return res
          .status(409)
          .json({ error: 'PASSWORD_ALREADY_SET' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      })

      // Link pledges for this user
      await linkPaidOrRecentPledgesToUser(updated.id, updated.email)

      const token = signToken({
        id: updated.id,
        role: updated.role,
        email: updated.email,
      })
      res.json({ ok: true, token, role: updated.role })
    } catch (e) {
      res.status(500).json({ error: 'Internal error' })
    }
  },
)

/* =========================================================
   POST /api/auth/register-after-payment
   body: { email, password }
   ========================================================= */

router.post(
  '/register-after-payment',
  async (req: Request, res: Response) => {
    try {
      const { email, password } = (req.body || {}) as {
        email?: string
        password?: string
      }
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: 'Missing email or password' })
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password too short' })
      }

      const passwordHash = await bcrypt.hash(password, 10)

      let user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        user = await prisma.user.create({
          data: { email, passwordHash, role: Role.USER },
        })
      } else if (!user.passwordHash) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        })
      }

      // Link pledges for this user
      await linkPaidOrRecentPledgesToUser(user.id, user.email)

      const token = signToken({
        id: user.id,
        role: user.role,
        email: user.email,
      })
      res.json({ ok: true, token, role: user.role })
    } catch (e) {
      res.status(500).json({ error: 'Internal error' })
    }
  },
)

/* =========================================================
   POST /api/auth/claim-paid
   body: { email, sessionId? }
   Ensures pledges are linked immediately after redirect.
   ========================================================= */

router.post('/claim-paid', async (req: Request, res: Response) => {
  try {
    const { email, sessionId } = (req.body || {}) as {
      email?: string
      sessionId?: string
    }
    if (!email) return res.status(400).json({ error: 'Missing email' })

    if (sessionId) {
      await prisma.pledge.updateMany({
        where: { providerId: sessionId },
        data: { email },
      })
    }

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, role: Role.USER },
      })
    }

    // IMPORTANT: use canonical DB email
    await linkPaidOrRecentPledgesToUser(user.id, user.email)

    const token = signToken({
      id: user.id,
      role: user.role,
      email: user.email,
    })
    res.json({ ok: true, token, role: user.role })
  } catch (e) {
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/debug-backfill-adoptions
   body: { email }
   One-time helper to backfill Subscriptions from existing Pledges
   for a given user email.
   ========================================================= */

router.post(
  '/debug-backfill-adoptions',
  async (req: Request, res: Response) => {
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
      const result = await linkPaidOrRecentPledgesToUser(
        user.id,
        user.email,
        {
          graceMinutes: 60 * 24 * 365,
        },
      )

      return res.json({
        ok: true,
        processed: result.processed,
      })
    } catch (e) {
      console.error('[debug-backfill-adoptions] error:', e)
      return res.status(500).json({ error: 'Internal error' })
    }
  },
)

/* =========================================================
   POST /api/auth/forgot-password
   body: { email }
   Always responds with 200 + generic message.
   ========================================================= */

router.post(
  '/forgot-password',
  async (req: Request, res: Response): Promise<void> => {
    const raw = (req.body?.email ?? '') as string
    const email = raw.trim()
    if (!email) {
      res.status(400).json({ error: 'Email je povinný' })
      return
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      })

      // Do not reveal if user exists – always 200
      if (!user) {
        res.json({
          ok: true,
          message:
            'Pokud u nás tento e-mail existuje, poslali jsme odkaz pro obnovu hesla.',
        })
        return
      }

      const secret = process.env.JWT_SECRET as Secret | undefined
      if (!secret) {
        console.error('[forgot-password] Missing JWT_SECRET')
        res.status(500).json({ error: 'Server misconfiguration' })
        return
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, type: 'password-reset' },
        secret,
        { expiresIn: '1h' },
      )

      const link = `${APP_BASE_URL}/obnovit-heslo?token=${encodeURIComponent(
        token,
      )}`

      const subject = 'Dogpoint – obnova hesla'
      const textBody = `Dobrý den,

obdrželi jsme požadavek na obnovu hesla k účtu s tímto e-mailem.

Pokud jste to byli vy, otevřete následující odkaz a nastavte si nové heslo:

${link}

Odkaz je platný 1 hodinu. Pokud jste o obnovu hesla nežádali, můžete tento e-mail ignorovat.

Děkujeme,
Dogpoint`
      const htmlBody = `
        <p>Dobrý den,</p>
        <p>obdrželi jsme požadavek na obnovu hesla k účtu s tímto e-mailem.</p>
        <p>Pokud jste to byli vy, klikněte na následující odkaz a nastavte si nové heslo:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Odkaz je platný 1 hodinu. Pokud jste o obnovu hesla nežádali, můžete tento e-mail ignorovat.</p>
        <p>Děkujeme,<br/>Dogpoint</p>
      `

      try {
        await resetTransporter.sendMail({
          from: EMAIL_FROM,
          to: user.email,
          subject,
          text: textBody,
          html: htmlBody,
        })
      } catch (e: any) {
        console.error('[forgot-password] sendMail failed', e?.message)
        // still respond OK, to avoid leaking anything
      }

      res.json({
        ok: true,
        message:
          'Pokud u nás tento e-mail existuje, poslali jsme odkaz pro obnovu hesla.',
      })
    } catch (e: any) {
      console.error('POST /api/auth/forgot-password error:', e)
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

/* =========================================================
   POST /api/auth/reset-password
   body: { token, password }
   ========================================================= */

router.post(
  '/reset-password',
  async (req: Request, res: Response): Promise<void> => {
    const { token, password } = (req.body || {}) as {
      token?: string
      password?: string
    }

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Chybí token pro obnovu hesla.' })
      return
    }
    if (!password || password.length < 8) {
      res.status(400).json({
        error: 'Heslo musí mít alespoň 8 znaků.',
      })
      return
    }

    const secret = process.env.JWT_SECRET as Secret | undefined
    if (!secret) {
      res.status(500).json({ error: 'Server misconfiguration' })
      return
    }

    try {
      const decoded = jwt.verify(token, secret) as any

      if (decoded?.type !== 'password-reset' || !decoded?.id) {
        res
          .status(400)
          .json({ error: 'Neplatný token pro obnovu hesla.' })
        return
      }

      const userId = String(decoded.id)

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        res.status(400).json({ error: 'Uživatel nenalezen.' })
        return
      }

      const hash = await bcrypt.hash(password, 10)

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hash },
      })

      res.json({ ok: true, message: 'Heslo bylo úspěšně změněno.' })
    } catch (e: any) {
      if (e?.name === 'TokenExpiredError') {
        res.status(400).json({ error: 'Platnost odkazu již vypršela.' })
        return
      }
      console.error('POST /api/auth/reset-password error:', e)
      res.status(400).json({ error: 'Neplatný nebo poškozený token.' })
    }
  },
)

export default router