// backend/src/routes/fio.ts
import { Router } from 'express'
import { Role } from '@prisma/client'
import { prisma } from '../prisma'
import { importFioTransactions } from '../services/fioImport'
import { checkRole } from '../middleware/checkRole' // adjust path to your real middleware

const router = Router()

router.get('/status', checkRole(Role.ADMIN), async (_req, res) => {
  const cursor = await prisma.fioCursor.findUnique({ where: { id: 1 } })
  res.json({ ok: true, cursor })
})

router.post('/import', checkRole(Role.ADMIN), async (req, res) => {
  const daysBack = typeof req.body?.daysBack === 'number' ? req.body.daysBack : undefined
  const result = await importFioTransactions({ daysBack })
  res.json(result)
})

export default router