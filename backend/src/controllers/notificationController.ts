// backend/src/controllers/notificationController.ts
import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyToken, JwtPayload } from '../utils/jwt'

const prisma = new PrismaClient()

type Req = Request & { user?: JwtPayload }

// --- helper to read JWT from Authorization header ---
function getAuth(req: Request): JwtPayload | null {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  return verifyToken(token)
}

// Shape for notifications we create from other controllers
export type NotifyPayload = {
  type: string
  title: string
  message: string
}

/**
 * Helper used from other controllers (adoption, stripe, etc.)
 * - creates DB notification
 * - later we can extend it to also send e-mail
 */
export async function notifyUser(userId: string, payload: NotifyPayload) {
  const notif = await prisma.notification.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      // createdAt is handled by @default(now()) in Prisma
    },
  })

  // TODO: add e-mail sending here if needed
  // e.g. await sendNotificationEmail(userId, payload)

  return notif
}

// GET /api/notifications
// -> { ok: true, notifications: [...] }
export async function listMyNotifications(req: Req, res: Response) {
  const auth = getAuth(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.id },
    orderBy: { createdAt: 'desc' },
  })

  return res.json({ ok: true, notifications })
}

// POST /api/notifications/:id/read
// For now: mark as handled by DELETING the notification
export async function markNotificationRead(req: Req, res: Response) {
  const auth = getAuth(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  if (!id) return res.status(400).json({ error: 'notification id required' })

  const result = await prisma.notification.deleteMany({
    where: { id, userId: auth.id },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Notifikace nenalezena' })
  }

  return res.json({ ok: true, deletedCount: result.count })
}