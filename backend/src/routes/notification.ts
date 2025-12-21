// backend/src/routes/notification.ts
import { Router } from 'express'
import { requireAuth } from '../middleware/authJwt'
import {
  listMyNotifications,
  markNotificationRead,
} from '../controllers/notificationController'

const router = Router()

// GET /api/notifications
router.get('/', requireAuth, listMyNotifications)

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, markNotificationRead)

export default router