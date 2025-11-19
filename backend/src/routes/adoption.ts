// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { checkAuth } from '../middleware/checkAuth' // ⚠️ adjust path/name if your auth middleware differs

const router = Router()

/**
 * GET /api/adoption/my
 * Return all adopted animals for the logged-in user.
 *
 * Uses Subscription table:
 * Subscription { id, userId, animalId, status, startedAt, ... }
 */
router.get('/my', checkAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user
    const userId = authUser?.sub || authUser?.id

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Find all ACTIVE or PENDING subscriptions for this user
    const subs = await prisma.subscription.findMany({
      where: {
        userId,
        status: {
          in: ['ACTIVE', 'PENDING'] as any,
        },
      },
      include: {
        animal: {
          select: {
            id: true,
            jmeno: true,
            name: true,
            main: true,
          },
        },
      },
      orderBy: {
        startedAt: 'asc',
      },
    })

    const items = subs.map((sub) => ({
      animalId: sub.animalId,
      title: sub.animal?.jmeno || sub.animal?.name || 'Zvíře',
      main: sub.animal?.main || undefined,
      since: sub.startedAt,
      status: sub.status as any, // 'ACTIVE' | 'PENDING' etc.
    }))

    return res.json(items)
  } catch (e) {
    console.error('[adoption/my] error:', e)
    return res.status(500).json({ error: 'Failed to load adoptions' })
  }
})

export default router