// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { checkAuth } from '../middleware/checkAuth'
import { SubscriptionStatus } from '@prisma/client'

const router = Router()

function getUserId(req: Request): string | null {
  const u = (req as any).user
  return (u?.sub || u?.id || null) as string | null
}

/**
 * GET /api/adoption/my
 * Returns adoptions for logged-in user.
 * Includes ACTIVE and PENDING (so BANK pending shows too).
 */
router.get('/my', checkAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const subs = await prisma.subscription.findMany({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
      },
      include: {
        animal: {
          select: { id: true, jmeno: true, name: true, main: true },
        },
      },
      orderBy: { startedAt: 'asc' },
    })

    const items = subs.map((sub) => ({
      subscriptionId: sub.id,
      animalId: sub.animalId,
      title: sub.animal?.jmeno || sub.animal?.name || 'Zvíře',
      main: sub.animal?.main || undefined,
      since: sub.startedAt,
      status: sub.status, // ACTIVE | PENDING
    }))

    return res.json(items)
  } catch (e: any) {
    console.error('[adoption/my] error:', e?.message || e)
    return res.status(500).json({ error: 'Failed to load adoptions' })
  }
})

/**
 * POST /api/adoption/cancel
 * body: { animalId: string }
 *
 * Cancels ACTIVE/PENDING subscriptions for this user+animal.
 */
router.post('/cancel', checkAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const animalId = req.body?.animalId ? String(req.body.animalId) : ''
    if (!animalId) return res.status(400).json({ error: 'Missing animalId' })

    const result = await prisma.subscription.updateMany({
      where: {
        userId,
        animalId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
      },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    })

    if (!result.count) return res.status(404).json({ error: 'Adoption not found' })
    return res.json({ ok: true, canceled: result.count })
  } catch (e: any) {
    console.error('[adoption/cancel] error:', e?.message || e)
    return res.status(500).json({ error: 'Failed to cancel adoption' })
  }
})

/**
 * POST /api/adoption/seen
 * body: { animalId?: string }
 *
 * Minimal endpoint (no persistence yet) so frontend won't fail.
 */
router.post('/seen', checkAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const animalId = req.body?.animalId ? String(req.body.animalId) : null

    return res.json({
      ok: true,
      userId,
      animalId,
      seenAt: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[adoption/seen] error:', e?.message || e)
    return res.status(500).json({ error: 'Failed to mark seen' })
  }
})

export default router