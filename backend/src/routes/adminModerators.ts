// backend/src/routes/adminModerators.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { Secret } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { requireAuth, requireAdmin } from '../middleware/authJwt'
import { sendEmailSafe } from '../services/email'

const router = Router()

// All routes below require ADMIN
router.use(requireAuth, requireAdmin)

/* ──────────────────────────────────────────────
   Helpers
────────────────────────────────────────────── */

function frontendBase(): string {
  return (process.env.PUBLIC_WEB_BASE_URL || process.env.FRONTEND_BASE_URL || 'https://example.com').replace(
    /\/+$/,
    '',
  )
}

function normalizeEmail(x?: string | null): string {
  return String(x || '').trim().toLowerCase()
}

function signInviteToken(user: { id: string; email: string; role: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')

  // purpose=invite so we can distinguish it later if needed
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, purpose: 'invite' },
    rawSecret as Secret,
    { expiresIn: '14d' },
  )
}

async function sendModeratorInviteEmail(to: string, inviteUrl: string) {
  const subject = 'Pozvánka do administrace Dogpoint'
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Pozvánka do administrace</h2>
      <p>Byl/a jste pozván/a jako <b>moderátor</b> do Dogpoint.</p>
      <p>Pro nastavení hesla a aktivaci účtu klikněte zde:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Pokud jste o pozvánku nežádal/a, tento e-mail ignorujte.</p>
      <hr />
      <p style="color:#666">Dogpoint</p>
    </div>
  `
  await sendEmailSafe({ to, subject, html })
}

/* ──────────────────────────────────────────────
   GET /api/admin/moderators
────────────────────────────────────────────── */
router.get('/moderators', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: 'MODERATOR' },
    select: { id: true, email: true, role: true, passwordHash: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  // do not return passwordHash; return invited flag instead
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      invited: !u.passwordHash, // no password set yet -> likely invited user
    })),
  )
})

/* ──────────────────────────────────────────────
   POST /api/admin/moderators  { email, password }
   (existing behavior)
────────────────────────────────────────────── */
router.post('/moderators', async (req: Request, res: Response) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })

  const e = normalizeEmail(email)

  const exists = await prisma.user.findUnique({ where: { email: e } })
  if (exists) return res.status(409).json({ error: 'User already exists' })

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email: e, role: 'MODERATOR', passwordHash: hash },
  })

  res.status(201).json({ id: user.id, email: user.email, role: user.role })
})

/* ──────────────────────────────────────────────
   POST /api/admin/moderators/:id/resend-invite
   Resend invitation e-mail (token link to set password)
────────────────────────────────────────────── */
router.post('/moderators/:id/resend-invite', async (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ error: 'Missing id' })

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, passwordHash: true },
  })

  if (!user) return res.status(404).json({ error: 'Not found' })
  if (user.role !== 'MODERATOR') return res.status(400).json({ error: 'User is not MODERATOR' })

  const token = signInviteToken({ id: user.id, email: user.email, role: user.role })
  const inviteUrl = `${frontendBase()}/nastavit-heslo?token=${encodeURIComponent(token)}`

  await sendModeratorInviteEmail(user.email, inviteUrl)

  res.json({
    ok: true,
    sentTo: user.email,
    alreadyActivated: !!user.passwordHash,
  })
})

/* ──────────────────────────────────────────────
   DELETE /api/admin/moderators/:id
────────────────────────────────────────────── */
router.delete('/moderators/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    await prisma.user.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

/* ──────────────────────────────────────────────
   PATCH /api/admin/moderators/:id/password  { password }
────────────────────────────────────────────── */
router.patch('/moderators/:id/password', async (req: Request, res: Response) => {
  const id = req.params.id
  const { password } = req.body || {}
  if (!password) return res.status(400).json({ error: 'Missing password' })

  const hash = await bcrypt.hash(password, 10)
  try {
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

export default router