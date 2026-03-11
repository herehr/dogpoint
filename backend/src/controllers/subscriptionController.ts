import { Request, Response } from 'express'
import { PrismaClient, SubscriptionStatus, PaymentProvider, PaymentMethod } from '@prisma/client'
import { sendEmailSafe } from '../services/email'
import { renderDogpointEmailLayout } from '../services/emailTemplates'

const prisma = new PrismaClient()

const APP_BASE = (process.env.APP_BASE_URL || 'https://patron.dog-point.cz').replace(/\/+$/, '')

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

/* ──────────────────────────────────────────────────────────
   Gift recipients (obdarovaní)
─────────────────────────────────────────────────────────── */

export async function listGiftRecipients(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Nepřihlášený uživatel' })
  const { id: subscriptionId } = req.params

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId, status: SubscriptionStatus.ACTIVE },
    include: {
      giftRecipients: {
        select: { id: true, email: true, displayName: true, userId: true, createdAt: true },
      },
    },
  })
  if (!sub) return res.status(404).json({ error: 'Adopce nenalezena' })

  return res.json(sub.giftRecipients)
}

export async function addGiftRecipient(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Nepřihlášený uživatel' })
  const { id: subscriptionId } = req.params
  const { email, displayName } = (req.body || {}) as { email?: string; displayName?: string }

  const emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!emailTrim) return res.status(400).json({ error: 'E-mail je povinný' })

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId, status: SubscriptionStatus.ACTIVE },
    include: { animal: { select: { jmeno: true, name: true } } },
  })
  if (!sub) return res.status(404).json({ error: 'Adopce nenalezena' })

  const existingCount = await prisma.subscriptionGiftRecipient.count({
    where: { subscriptionId },
  })
  if (existingCount >= 5) return res.status(400).json({ error: 'Maximálně 5 obdarovaných na adopci' })

  const existing = await prisma.user.findUnique({ where: { email: emailTrim } })
  const recipient = await prisma.subscriptionGiftRecipient.upsert({
    where: {
      subscriptionId_email: { subscriptionId, email: emailTrim },
    },
    create: {
      subscriptionId,
      email: emailTrim,
      displayName: displayName?.trim() || null,
      userId: existing?.id ?? null,
    },
    update: {
      displayName: displayName?.trim() || null,
      userId: existing?.id ?? undefined,
    },
    select: { id: true, email: true, displayName: true, userId: true, createdAt: true },
  })

  // Send invite email (best-effort, don't block)
  const animalName = (sub.animal as any)?.jmeno || (sub.animal as any)?.name || 'zvíře'
  const loginUrl = `${APP_BASE}/login`
  const introHtml = `Někdo ti daroval adopci zvířete <strong>${escapeHtml(animalName)}</strong> na Dogpointu.<br/><br/>
  Zaregistruj se nebo přihlas s e-mailem <strong>${escapeHtml(emailTrim)}</strong> a uvidíš všechny příspěvky adoptovaného zvířete.`
  const { html, text } = renderDogpointEmailLayout({
    title: 'Darovaná adopce',
    introHtml,
    buttonText: 'Přihlásit se',
    buttonUrl: loginUrl,
    plainTextFallbackUrl: loginUrl,
    footerNoteHtml: 'Pac a pusu posílá tým z Dogpointu.',
  })
  sendEmailSafe({
    to: emailTrim,
    subject: `Darovaná adopce – ${animalName}`,
    html,
    text,
  }).catch((e: any) => console.warn('[addGiftRecipient] invite email failed:', e?.message))

  return res.status(201).json(recipient)
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function removeGiftRecipient(req: AuthedReq, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Nepřihlášený uživatel' })
  const { id: subscriptionId, recipientId } = req.params

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId, status: SubscriptionStatus.ACTIVE },
  })
  if (!sub) return res.status(404).json({ error: 'Adopce nenalezena' })

  const deleted = await prisma.subscriptionGiftRecipient.deleteMany({
    where: { id: recipientId, subscriptionId },
  })
  if (deleted.count === 0) return res.status(404).json({ error: 'Obdarovaný nenalezen' })

  return res.json({ ok: true })
}