/**
 * One-time repair: backup + FIO + Stripe import.
 * Used by API route and CLI script.
 *
 * FIO: Data older than 90 days requires strong auth in internet banking.
 * We limit to last 90 days to avoid 422; for older data, authorize in FIO and run again.
 */
import Stripe from 'stripe'
import { prisma } from '../prisma'
import { PaymentStatus } from '@prisma/client'
import { importFioTransactions } from './fioImport'

const FIO_CHUNK_DAYS = 90
const FIO_MAX_DAYS_WITHOUT_AUTH = 80

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

function fioFromDate(): Date {
  const to = new Date()
  const from = addDays(to, -FIO_MAX_DAYS_WITHOUT_AUTH)
  return from
}

export async function backupPayments(): Promise<object[]> {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      subscription: {
        select: {
          userId: true,
          animalId: true,
          provider: true,
          variableSymbol: true,
        },
      },
    },
  })

  // Store backup in PaymentBackup table (if it exists)
  const snapshotAt = new Date()
  if (payments.length > 0) {
    try {
      await prisma.paymentBackup.createMany({
        data: payments.map((p) => ({
          snapshotAt,
          originalId: p.id,
          subscriptionId: p.subscriptionId,
          provider: p.provider,
          providerRef: p.providerRef,
          amount: p.amount,
          currency: p.currency || 'CZK',
          status: p.status,
          paidAt: p.paidAt,
          failureReason: p.failureReason,
          createdAt: p.createdAt,
        })),
      })
    } catch (e: any) {
      // Table may not exist if migration not run on this DB (e.g. dev)
      const missingTable = e?.code === 'P2021' || e?.message?.includes('does not exist')
      if (!missingTable) throw e
    }
  }

  return payments as object[]
}

export async function runFioImport(): Promise<{ created: number }> {
  const token = process.env.FIO_TOKEN
  if (!token) return { created: 0 }

  let totalCreated = 0
  let from = fioFromDate()
  const to = new Date()

  while (from <= to) {
    const chunkEnd = addDays(from, FIO_CHUNK_DAYS - 1)
    const toDate = chunkEnd > to ? to : chunkEnd
    const fromISO = from.toISOString().slice(0, 10)
    const toISO = toDate.toISOString().slice(0, 10)

    const result = await importFioTransactions({ fromISO, toISO })
    totalCreated += result.createdPayments
    from = addDays(toDate, 1)
  }

  return { created: totalCreated }
}

export async function runStripeSync(): Promise<{ created: number }> {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  if (!key) return { created: 0 }

  const stripe = new Stripe(key)
  const subs = await prisma.subscription.findMany({
    where: { provider: 'STRIPE', providerRef: { not: null } },
    select: { id: true, providerRef: true },
  })

  let created = 0
  let skipped = 0

  for (const sub of subs) {
    let stripeSubId: string | null = sub.providerRef
    if (!stripeSubId) continue

    if (stripeSubId.startsWith('cs_')) {
      try {
        const session = await stripe.checkout.sessions.retrieve(stripeSubId, { expand: ['subscription'] })
        const raw = (session as any).subscription
        const resolved = typeof raw === 'string' ? raw : raw?.id ?? null
        if (resolved) {
          await prisma.$executeRaw`UPDATE "Subscription" SET "providerRef" = ${resolved} WHERE id = ${sub.id}`
          stripeSubId = resolved
        } else {
          stripeSubId = null
        }
      } catch {
        continue
      }
    }
    if (!stripeSubId || !stripeSubId.startsWith('sub_')) continue

    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const list = await stripe.invoices.list({
        subscription: stripeSubId,
        status: 'paid',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })

      for (const inv of list.data) {
        const providerRef = inv.id
        const existing = await prisma.payment.findFirst({
          where: { subscriptionId: sub.id, providerRef },
          select: { id: true },
        })
        if (existing) {
          skipped++
          continue
        }

        const amountCZK = inv.amount_paid != null ? Math.round(Number(inv.amount_paid) / 100) : 0
        const paidAt =
          (inv as any).status_transitions?.paid_at != null
            ? new Date(Number((inv as any).status_transitions.paid_at) * 1000)
            : new Date()

        try {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              provider: 'STRIPE',
              providerRef,
              amount: amountCZK || 1,
              currency: (inv.currency || 'czk').toUpperCase(),
              status: PaymentStatus.PAID,
              paidAt,
            } as any,
          })
          created++
        } catch (e: any) {
          if (e?.code === 'P2002') skipped++
        }
      }

      hasMore = list.has_more
      if (list.data.length > 0) startingAfter = list.data[list.data.length - 1].id
      else hasMore = false
    }
  }

  return { created }
}

export type RepairImportResult = {
  ok: true
  backupCount: number
  backup: object[]
  fioCreated: number
  stripeCreated: number
  fromDate: string
  toDate: string
}

export async function runRepairImport(): Promise<RepairImportResult> {
  const backup = await backupPayments()
  const fioResult = await runFioImport()
  const stripeResult = await runStripeSync()

  return {
    ok: true,
    backupCount: backup.length,
    backup,
    fioCreated: fioResult.created,
    stripeCreated: stripeResult.created,
    fromDate: fioFromDate().toISOString().slice(0, 10),
    toDate: todayISO(),
  }
}
