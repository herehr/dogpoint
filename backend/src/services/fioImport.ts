// backend/src/services/fioImport.ts
import { prisma } from '../prisma'
import { fioFetchLast, fioSetLastId, normalizeFioTx } from './fioClient'
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

function isoDateOnly(d: Date): string {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

export type FioImportResult = {
  ok: true
  from: string
  to: string
  fetched: number
  createdPayments: number
  matchedSubs: number
  skippedNoMatch: number
  skippedMissingAmount: number
}

/**
 * Imports Fio transactions for a date window.
 * Idempotency:
 * - Payment has @@unique([provider, providerRef])
 * - providerRef uses "fio:<transactionId>"
 *
 * Matching:
 * - primary: Subscription.variableSymbol == tx.variableSymbol
 * - fallback: try find variable symbol inside message (optional)
 */
export async function importFioTransactions(options?: { daysBack?: number }): Promise<FioImportResult> {
  const daysBack = options?.daysBack ?? Number(process.env.FIO_IMPORT_DAYS || 7)

  const toDate = new Date()
  const fromDate = addDaysUTC(toDate, -daysBack)

  const from = isoDateOnly(fromDate)
  const to = isoDateOnly(toDate)

  // Fetch from Fio
  const statement = await fioFetchPeriod({ from, to })
  const rawList = statement?.accountStatement?.transactionList?.transaction ?? []
  const txs = rawList.map(normalizeFioTx)

  let createdPayments = 0
  let matchedSubs = 0
  let skippedNoMatch = 0
  let skippedMissingAmount = 0

  for (const tx of txs) {
    const txId = tx.transactionId
    if (!txId) continue

    if (typeof tx.amount !== 'number' || Number.isNaN(tx.amount)) {
      skippedMissingAmount++
      continue
    }

    // FIO is in CZK typically; store in integer "cents" equivalent? Your schema uses Int CZK.
    // If Fio returns 200.00 => store 200 (CZK), not 20000.
    const amountInt = Math.round(tx.amount)

    // Find subscription by variable symbol
    let sub = null as null | { id: string; status: any }

    const vs = (tx.variableSymbol || '').trim()
    if (vs) {
      sub = await prisma.subscription.findFirst({
        where: { provider: PaymentProvider.FIO, variableSymbol: vs },
        select: { id: true, status: true },
      })
    }

    if (!sub) {
      skippedNoMatch++
      continue
    }

    matchedSubs++

    const providerRef = `fio:${String(txId)}`

    // Create payment if not exists (unique guard)
    try {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          provider: PaymentProvider.FIO,
          providerRef,
          amount: amountInt,
          currency: (tx.currency || 'CZK').toUpperCase(),
          status: PaymentStatus.PAID,
          paidAt: tx.date ? new Date(tx.date) : new Date(),
        },
      })
      createdPayments++
    } catch (e: any) {
      // Unique violation = already imported
      if (e?.code === 'P2002') {
        // ignore
      } else {
        throw e
      }
    }

    // Ensure subscription active if not canceled
    if (sub.status !== SubscriptionStatus.CANCELED) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startedAt: new Date(),
          // optional: clear bank grace/timeline when paid
          tempAccessUntil: null,
          graceUntil: null,
          reminderSentAt: null,
          reminderCount: 0,
        },
      })
    }
  }

  // Update cursor (optional: store last tx id)
  const lastTxId = txs.length ? String(txs[txs.length - 1]?.transactionId ?? '') : null
  await prisma.fioCursor.upsert({
    where: { id: 1 },
    create: { id: 1, lastId: lastTxId || null },
    update: { lastId: lastTxId || null },
  })

  return {
    ok: true,
    from,
    to,
    fetched: txs.length,
    createdPayments,
    matchedSubs,
    skippedNoMatch,
    skippedMissingAmount,
  }
}