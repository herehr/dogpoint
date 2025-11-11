import { Request, Response } from 'express'
import { PrismaClient, SubscriptionStatus, PaymentProvider } from '@prisma/client'
import { signToken, verifyToken, JwtPayload } from '../utils/jwt'

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
    where: { userId: auth.id, animalId, status: 'ACTIVE' },
    select: { id: true }
  })
  return res.json({ access: !!sub })
}

// GET /api/adoption/me
// -> { ok: true, user: { id, email, role }, access: { [animalId]: true } }
export async function getMe(req: Req, res: Response) {
  const auth = getAuth(req)
  if (!auth) return res.status(200).json({ ok: false, user: null, access: {} })

  const user = await prisma.user.findUnique({ where: { id: auth.id }, select: { id: true, email: true, role: true } })
  const subs = await prisma.subscription.findMany({
    where: { userId: auth.id, status: 'ACTIVE' },
    select: { animalId: true }
  })
  const access: Record<string, boolean> = {}
  subs.forEach(s => { access[s.animalId] = true })

  return res.json({ ok: true, user, access })
}

// POST /api/adoption/start
// body: { animalId, email?, name?, monthly? }
// If not logged in and email is given, create/find user and return {token} so your frontend stores accessToken.
// Creates a Subscription: BANK -> ACTIVE; CARD via Stripe would be PENDING (wire later).
export async function startAdoption(req: Req, res: Response) {
  const { animalId, email, name, monthly } = (req.body || {}) as {
    animalId: string; email?: string; name?: string; monthly?: number
  }
  if (!animalId) return res.status(400).json({ error: 'animalId required' })

  // who is the user?
  let auth = getAuth(req)
  let userId = auth?.id

  if (!userId) {
    if (!email) return res.status(401).json({ error: 'email required when not logged in' })
    // find or create USER
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, role: 'USER', passwordHash: null }
      })
    }
    userId = user.id
    const token = signToken({ id: user.id, role: user.role as any })
    // Also create the subscription below and include token in response
    const sub = await prisma.subscription.create({
      data: {
        userId,
        animalId,
        monthlyAmount: monthly ?? 200,
        provider: PaymentProvider.FIO, // BANK by default; swap to STRIPE when integrating card flow
        status: 'ACTIVE'
      },
      select: { id: true, status: true }
    })
    return res.json({
      ok: true,
      token,
      access: { [animalId]: sub.status === 'ACTIVE' },
      userHasPassword: !!user.passwordHash
    })
  }

  // logged in: create/activate subscription
  const sub = await prisma.subscription.create({
    data: {
      userId,
      animalId,
      monthlyAmount: monthly ?? 200,
      provider: PaymentProvider.FIO, // BANK default
      status: 'ACTIVE'
    },
    select: { id: true, status: true }
  })
  return res.json({ ok: true, access: { [animalId]: sub.status === 'ACTIVE' } })
}

// POST /api/adoption/end
// body: { animalId }
export async function endAdoption(req: Req, res: Response) {
  const auth = getAuth(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { animalId } = (req.body || {}) as { animalId: string }
  if (!animalId) return res.status(400).json({ error: 'animalId required' })

  const sub = await prisma.subscription.findFirst({
    where: { userId: auth.id, animalId, status: 'ACTIVE' },
    select: { id: true }
  })
  if (!sub) return res.status(404).json({ error: 'Aktivní adopce nenalezena' })

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() }
  })

  return res.json({ ok: true })
}