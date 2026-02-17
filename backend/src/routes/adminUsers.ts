// backend/src/routes/adminUsers.ts
// GET /api/admin/users - list all users with name, address, adoptions
// PATCH /api/admin/users/:id - update user name/address
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireAuth, requireStaff } from '../middleware/authJwt'

const router = Router()
router.use(requireAuth, requireStaff)

/* GET /api/admin/users */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        street: true,
        streetNo: true,
        zip: true,
        city: true,
        role: true,
        subscriptions: {
          select: {
            id: true,
            animalId: true,
            status: true,
            monthlyAmount: true,
            startedAt: true,
            animal: { select: { id: true, jmeno: true, name: true } },
          },
        },
      },
      orderBy: { email: 'asc' },
    })

    res.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        street: u.street,
        streetNo: u.streetNo,
        zip: u.zip,
        city: u.city,
        role: u.role,
        adoptions: u.subscriptions.map((s) => ({
          id: s.id,
          animalId: s.animalId,
          animalName: s.animal?.jmeno || s.animal?.name || s.animalId,
          status: s.status,
          monthlyAmount: s.monthlyAmount,
          startedAt: s.startedAt,
        })),
      })),
    })
  } catch (e: any) {
    console.error('[admin/users] GET error', e)
    res.status(500).json({ error: e?.message || 'Internal error' })
  }
})

/* PATCH /api/admin/users/:id - update name, address */
router.patch('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  const body = (req.body || {}) as {
    firstName?: string
    lastName?: string
    street?: string
    streetNo?: string
    zip?: string
    city?: string
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const data: Record<string, unknown> = {}
    if (typeof body.firstName === 'string') data.firstName = body.firstName.trim() || null
    if (typeof body.lastName === 'string') data.lastName = body.lastName.trim() || null
    if (typeof body.street === 'string') data.street = body.street.trim() || null
    if (typeof body.streetNo === 'string') data.streetNo = body.streetNo.trim() || null
    if (typeof body.zip === 'string') data.zip = body.zip.trim() || null
    if (typeof body.city === 'string') data.city = body.city.trim() || null

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    await prisma.user.update({
      where: { id },
      data: data as any,
    })

    res.json({ ok: true })
  } catch (e: any) {
    console.error('[admin/users] PATCH error', e)
    res.status(500).json({ error: e?.message || 'Update failed' })
  }
})

export default router
