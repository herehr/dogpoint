// backend/src/controllers/adoptionController.ts
import { Request, Response } from 'express'
import { PrismaClient, SubscriptionStatus, PaymentProvider } from '@prisma/client'
import { signToken, verifyToken, JwtPayload } from '../utils/jwt'

// ✅ notifications + e-mail
import { notifyAdoptionStarted, notifyAdoptionCancelled } from '../services/notifyAdoption'
import { sendEmail } from '../services/email'

const prisma = new PrismaClient()

type Req = Request & { user?: JwtPayload }

// --- helpers ---
function getAuth(req: Request): JwtPayload | null {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  return verifyToken(token)
}

// GET /api/adoption/access/:animalId
// -> { access: boolean }
export async function getAccess(req: Req, res: Response) {
  const auth = getAuth(req)
  const { animalId } = req.params
  if (!auth) return res.json({ access: false })

  const sub = await prisma.subscription.findFirst({
    where: {
      userId: auth.id,
      animalId,
      status: SubscriptionStatus.ACTIVE,
    },
    select: { id: true },
  })

  return res.json({ access: !!sub })
}

// GET /api/adoption/me
// -> { ok: true, user: { id, email, role }, access: { [animalId]: true } }
export async function getMe(req: Req, res: Response) {
  const auth = getAuth(req)
  if (!auth) return res.status(200).json({ ok: false, user: null, access: {} })

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id: true, email: true, role: true },
  })

  const subs = await prisma.subscription.findMany({
    where: { userId: auth.id, status: SubscriptionStatus.ACTIVE },
    select: { animalId: true },
  })

  const access: Record<string, boolean> = {}
  subs.forEach((s) => {
    access[s.animalId] = true
  })

  return res.json({ ok: true, user, access })
}

// POST /api/adoption/start
// body: { animalId, email?, name?, monthly? }
export async function startAdoption(req: Req, res: Response) {
  const { animalId, email, name, monthly } = (req.body || {}) as {
    animalId: string
    email?: string
    name?: string
    monthly?: number
  }
  if (!animalId) return res.status(400).json({ error: 'animalId required' })

  let auth = getAuth(req)
  let userId = auth?.id

  // ───────────────────────────────────────────
  // Not logged in → identify / create user
  // ───────────────────────────────────────────
  if (!userId) {
    if (!email) return res.status(401).json({ error: 'email required when not logged in' })

    // find or create USER
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, role: 'USER', passwordHash: null },
      })
    }
    userId = user.id
    const token = signToken({ id: user.id, role: user.role as any })

    const sub = await prisma.subscription.create({
      data: {
        userId,
        animalId,
        monthlyAmount: monthly ?? 200,
        provider: PaymentProvider.FIO,
        status: SubscriptionStatus.ACTIVE,
      },
      select: { id: true, status: true },
    })

    // ✅ Notification + email (never break the response)
    try {
      await notifyAdoptionStarted(userId, animalId, {
        monthlyAmount: monthly ?? 200,
        sendEmail: true,
        sendEmailFn: sendEmail,
      })
    } catch (e) {
      console.warn('[notifyAdoptionStarted] failed', e)
    }

    return res.json({
      ok: true,
      token,
      access: { [animalId]: sub.status === SubscriptionStatus.ACTIVE },
      userHasPassword: !!user.passwordHash,
    })
  }

  // ───────────────────────────────────────────
  // Logged in: create/activate subscription
  // ───────────────────────────────────────────
  const sub = await prisma.subscription.create({
    data: {
      userId,
      animalId,
      monthlyAmount: monthly ?? 200,
      provider: PaymentProvider.FIO,
      status: SubscriptionStatus.ACTIVE,
    },
    select: { id: true, status: true },
  })

  // ✅ Notification + email
  try {
    await notifyAdoptionStarted(userId, animalId, {
      monthlyAmount: monthly ?? 200,
      sendEmail: true,
      sendEmailFn: sendEmail,
    })
  } catch (e) {
    console.warn('[notifyAdoptionStarted] failed', e)
  }

  return res.json({
    ok: true,
    access: { [animalId]: sub.status === SubscriptionStatus.ACTIVE },
  })
}

// POST /api/adoption/end
// body: { animalId }
export async function endAdoption(req: Req, res: Response) {
  const auth = getAuth(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  const { animalId } = (req.body || {}) as { animalId: string }
  if (!animalId) return res.status(400).json({ error: 'animalId required' })

  const result = await prisma.subscription.updateMany({
    where: {
      userId: auth.id,
      animalId,
      status: SubscriptionStatus.ACTIVE,
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
    },
  })

  if (result.count === 0) {
    return res.status(404).json({ error: 'Aktivní adopce nenalezena' })
  }

  // ✅ Notification + email
  try {
    await notifyAdoptionCancelled(auth.id, animalId, {
      sendEmail: true,
      sendEmailFn: sendEmail,
    })
  } catch (e) {
    console.warn('[notifyAdoptionCancelled] failed', e)
  }

  return res.json({ ok: true, canceledCount: result.count })
}