// backend/src/routes/adminModerators.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { requireAuth, requireAdmin } from '../middleware/authJwt'

const router = Router()

// All routes below require ADMIN
router.use(requireAuth, requireAdmin)

// GET /api/admin/moderators
router.get('/moderators', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: 'MODERATOR' },
    select: { id: true, email: true, role: true }
  })
  res.json(users)
})

// POST /api/admin/moderators  { email, password }
router.post('/moderators', async (req: Request, res: Response) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return res.status(409).json({ error: 'User already exists' })
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, role: 'MODERATOR', passwordHash: hash }
  })
  res.status(201).json({ id: user.id, email: user.email, role: user.role })
})

// DELETE /api/admin/moderators/:id
router.delete('/moderators/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    await prisma.user.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

// PATCH /api/admin/moderators/:id/password  { password }
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