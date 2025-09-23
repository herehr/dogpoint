import { Request, Response } from 'express'
import { PrismaClient, SubscriptionStatus, PaymentProvider, PaymentMethod } from '@prisma/client'
const prisma = new PrismaClient()

type AuthedReq = Request & { user?: { id: string } }

export async function createSubscription(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Nepřihlášený uživatel' })

  const { animalId, monthlyAmount, method } = req.body as {
    animalId: string
    monthlyAmount: number
    method: PaymentMethod // 'CARD' | 'BANK'
  }

  const animal = await prisma.animal.findUnique({ where: { id: animalId } })
  if (!animal || animal.active === false) return res.status(404).json({ error: 'Zvíře nenalezeno' })

  // For CARD we’ll mark PENDING until Stripe returns webhooks; for BANK it can be ACTIVE
  const provider: PaymentProvider = method === 'CARD' ? 'STRIPE' : 'FIO'
  const status: SubscriptionStatus = method === 'BANK' ? 'ACTIVE' : 'PENDING'

  const sub = await prisma.subscription.create({
    data: {
      userId,
      animalId,
      monthlyAmount,
      provider,
      status,
      // for BANK, create a VS now or later; here we skip to keep it simple
    },
    select: { id: true, status: true }
  })

  return res.json(sub)
}

export async function cancelSubscription(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  const { id } = req.params

  const sub = await prisma.subscription.findUnique({ where: { id } })
  if (!sub || sub.userId !== userId) return res.status(404).json({ error: 'Adopce nenalezena' })
  if (sub.status === 'CANCELED') return res.status(400).json({ error: 'Adopce je již ukončena' })

  const updated = await prisma.subscription.update({
    where: { id },
    data: { status: 'CANCELED', canceledAt: new Date() },
    select: { id: true, status: true }
  })

  return res.json(updated)
}

export async function mySubscriptions(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Nepřihlášený uživatel' })

  const rows = await prisma.subscription.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { id: true, animalId: true }
  })

  return res.json(rows)
}

export async function isMineSubscription(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.json({ adopted: false, subscriptionId: null })
  const { animalId } = req.params

  const row = await prisma.subscription.findFirst({
    where: { userId, animalId, status: 'ACTIVE' },
    select: { id: true }
  })

  return res.json({ adopted: !!row, subscriptionId: row?.id ?? null })
}