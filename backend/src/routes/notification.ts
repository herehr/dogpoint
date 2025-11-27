// backend/src/routes/notification.ts
import { Router } from 'express'
import {
  listMyNotifications,
  markNotificationRead,
} from '../controllers/notificationController'

const router = Router()

// GET /api/notifications
router.get('/', listMyNotifications)

// POST /api/notifications/:id/read
router.post('/:id/read', markNotificationRead)

export default router