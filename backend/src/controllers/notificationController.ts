// backend/src/controllers/notificationController.ts
import { Request, Response } from 'express'
import { prisma } from '../prisma'

type JwtUser = { id: string; role?: string; email?: string }
type AuthedReq = Request & { user?: JwtUser }

// Shape for notifications we create from other controllers
export type NotifyPayload = {
  type: string
  title: string
  message: string
  animalId?: string | null
  postId?: string | null
}

/**
 * Helper used from other controllers (moderation, adoption, stripe, etc.)
 * - creates DB notification
 * - safe to call multiple times if you pass postId (dedupe via @@unique([userId, postId]))
 */
export async function notifyUser(userId: string, payload: NotifyPayload) {
  // If postId is present, use upsert-like behavior to avoid duplicate crashes.
  // If postId is missing, we just create a row (no dedupe possible).
  if (payload.postId) {
    const notif = await prisma.notification.upsert({
      where: {
        userId_postId: {
          userId,
          postId: payload.postId,
        },
      },
      create: {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        animalId: payload.animalId ?? null,
        postId: payload.postId,
      },
      update: {
        // If the same post triggers again, keep it unread and refresh content
        title: payload.title,
        message: payload.message,
        animalId: payload.animalId ?? null,
        readAt: null,
      },
    })
    return notif
  }

  return prisma.notification.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      animalId: payload.animalId ?? null,
      postId: payload.postId ?? null,
    },
  })
}

// GET /api/notifications
// -> { ok: true, notifications: [...] }
export async function listMyNotifications(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return res.json({ ok: true, notifications })
}

// POST /api/notifications/:id/read
// Mark as read (do NOT delete)
export async function markNotificationRead(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  if (!id) return res.status(400).json({ error: 'notification id required' })

  const updated = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  })

  if (updated.count === 0) {
    return res.status(404).json({ error: 'Notifikace nenalezena' })
  }

  return res.json({ ok: true })
}