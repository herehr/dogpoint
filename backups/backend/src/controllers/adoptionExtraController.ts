// backend/src/controllers/adoptionExtraController.ts
import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

type Authed = Request & { user?: { id: string } }

/**
 * GET /api/adoption/my-animals
 * Response: Array<{
 *   animal: { id: string; jmeno: string; main: string | null; active: boolean }
 *   monthly: number | null
 *   hasNew: boolean
 *   latestAt: string
 *   lastSeenAt: string | null
 * }>
 */
export async function myAdoptedAnimals(req: Authed, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  // active subscriptions for current user
  const subs = await prisma.subscription.findMany({
    where: { userId: req.user.id, status: 'ACTIVE' },
    select: {
      monthlyAmount: true,
      animal: {
        select: {
          id: true,
          jmeno: true,
          name: true,
          main: true,
          active: true,
        },
      },
    },
  })

  // compute latest post timestamp per animal (optional, safe if Post table exists)
  const results: Array<{
    animal: { id: string; jmeno: string; main: string | null; active: boolean }
    monthly: number | null
    hasNew: boolean
    latestAt: string
    lastSeenAt: string | null
  }> = []

  for (const s of subs) {
    const animalId = s.animal.id
    let latestAtISO = new Date(0).toISOString()

    try {
      const latest = await prisma.post.findFirst({
        where: { animalId, active: true },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (latest?.createdAt) latestAtISO = latest.createdAt.toISOString()
    } catch {
      // posts table might not exist yet or no posts — keep default date
    }

    results.push({
      animal: {
        id: animalId,
        jmeno: (s.animal.jmeno || s.animal.name || '') as string,
        main: (s.animal.main || null) as string | null,
        active: !!s.animal.active,
      },
      monthly: (s.monthlyAmount ?? null) as number | null,
      hasNew: false,          // simple baseline (flip later if you track lastSeenAt)
      latestAt: latestAtISO,  // latest public post time, if any
      lastSeenAt: null,       // no tracking yet (add a column later if needed)
    })
  }

  res.json(results)
}

/**
 * POST /api/adoption/seen
 * Body: { animalId }
 * Right now this is a no-op that returns {ok:true} so the frontend succeeds.
 * (You can later persist lastSeenAt on Subscription or a separate table.)
 */
export async function markAdoptionSeen(req: Authed, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
  const { animalId } = (req.body || {}) as { animalId?: string }
  if (!animalId) return res.status(400).json({ error: 'animalId required' })
  // TODO: persist lastSeenAt = now() for (userId, animalId)
  res.json({ ok: true })
}