// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { checkAuth } from '../middleware/checkAuth'

const router = Router()

/**
 * GET /api/adoption/my
 * Return all adopted animals for the logged-in user.
 */
router.get('/my', checkAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user
    const userId = authUser?.sub || authUser?.id

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

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
      status: sub.status as any,
    }))

    return res.json(items)
  } catch (e) {
    console.error('[adoption/my] error:', e)
    return res.status(500).json({ error: 'Failed to load adoptions' })
  }
})

/**
 * POST /api/adoption/cancel
 * body: { animalId: string }
 *
 * Marks the user's subscription for this animal as CANCELED.
 * Existing Stripe payments remain (cannot be undone), but the
 * adoption disappears from "Moje adopce" and detail is locked again.
 */
router.post('/cancel', checkAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user
    const userId = authUser?.sub || authUser?.id
    const { animalId } = (req.body || {}) as { animalId?: string }

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!animalId) {
      return res.status(400).json({ error: 'Missing animalId' })
    }

    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        animalId,
        status: {
          in: ['ACTIVE', 'PENDING'] as any,
        },
      },
    })

    if (!sub) {
      return res.status(404).json({ error: 'Adoption not found' })
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELED' as any,
        endedAt: new Date() as any,
      },
    })

    // We leave Pledge and Payment rows as they are (they describe past donations).
    return res.json({ ok: true })
  } catch (e) {
    console.error('[adoption/cancel] error:', e)
    return res.status(500).json({ error: 'Failed to cancel adoption' })
  }
})

export default router