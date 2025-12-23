import { Router } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'

const router = Router()

// POST /api/notifications/test
router.post('/test', requireAuth, async (req, res) => {
  const userId = req.user!.id

  const n = await prisma.notification.create({
    data: {
      userId,
      title: 'Test notification 🔔',
      message: 'This is a test notification from the backend.',
    },
  })

  res.json({ ok: true, notification: n })
})

export default router