// backend/src/controllers/notificationController.ts
import { Request, Response } from 'express'
import { prisma } from '../prisma'
import { AuthRequest } from '../types/express'

// You probably already have some mail util – adapt this stub:
async function sendEmail(to: string, subject: string, text: string) {
  console.log('[sendEmail stub]', { to, subject, text })
  // TODO: integrate with your real mail service / nodemailer
}

// --- API: list notifications for logged-in user ---
export async function getMyNotifications(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })

  const items = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return res.json({ items })
}

// --- API: mark single notification as read ---
export async function markNotificationRead(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })
  const { id } = req.params

  const updated = await prisma.notification.updateMany({
    where: { id, userId: req.user.id },
    data: { readAt: new Date() },
  })

  if (updated.count === 0) {
    return res.status(404).json({ error: 'Notifikace nenalezena' })
  }

  return res.json({ ok: true })
}

// --- Helper: create notification + email user ---
export async function notifyUser(
  userId: string,
  opts: { type: string; title: string; message: string }
) {
  // 1) create in DB
  const notif = await prisma.notification.create({
    data: {
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
    },
  })

  // 2) send email if user has email
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.email) {
    await sendEmail(
      user.email,
      opts.title,
      opts.message,
    )
  }

  return notif
}