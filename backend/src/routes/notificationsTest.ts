import { Router } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'

const router = Router()

// POST /api/notifications/test
router.post('/test', requireAuth, async (req, res) => {
  const userId = req.user!.id

  const notification = await prisma.notification.create({
  data: {
    userId,
    type: 'TEST' as any,
    title: 'Test notification 🔔',
    message: 'This is a test notification from the backend.',
  },
})

  res.json({ ok: true, notification })
})

export default router