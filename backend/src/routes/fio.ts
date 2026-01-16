// backend/src/routes/fio.ts
import { Router, Request, Response } from 'express'
import { importFioTransactions } from '../services/fioImport'
import { checkAuth } from '../middleware/checkAuth' // adjust path if needed
import { prisma } from '../prisma'

const router = Router()

function isAdmin(req: Request): boolean {
  const u = (req as any).user
  return u?.role === 'ADMIN'
}

/**
 * GET /api/fio/status
 */
router.get('/status', checkAuth, async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' })

    const cursor = await prisma.fioCursor.findUnique({
      where: { id: 1 },
      select: { lastId: true, updatedAt: true },
    })

    return res.json({
      ok: true,
      fioTokenConfigured: !!process.env.FIO_TOKEN,
      fioCron: process.env.FIO_CRON || null,
      cursor: cursor
        ? { lastId: cursor.lastId ?? null, updatedAt: cursor.updatedAt.toISOString() }
        : null,
    })
  } catch (e: any) {
    console.error('[fio/status] error', e?.message || e)
    return res.status(500).json({ error: 'internal error' })
  }
})

/**
 * POST /api/fio/import
 */
router.post('/import', checkAuth, async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' })

    const result = await importFioTransactions()
    return res.json(result)
  } catch (e: any) {
    console.error('[fio/import] error', e?.message || e)
    return res.status(500).json({ error: 'internal error' })
  }
})

export default router