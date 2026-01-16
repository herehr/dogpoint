// backend/src/services/fioImport.ts
import { prisma } from '../prisma'
import { fioFetchLast, fioSetLastId, normalizeFioTx, type NormalizedFioTx } from './fioClient'
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

export type FioImportResult = {
  ok: true
  fetched: number
  normalized: number
  createdPayments: number
  matchedSubs: number
  skippedNoVS: number
  skippedNoMatch: number
  skippedDuplicate: number
  skippedInvalidAmount: number
  lastDownloadId: string | null
}

/**
 * Imports transactions from Fio "last" endpoint.
 *
 * ✅ Idempotent:
 *   Payment has @@unique([provider, providerRef])
 *   providerRef = "fio:<movementId>"
 *
 * ✅ Matching:
 *   Subscription.provider = FIO AND Subscription.variableSymbol == tx.variableSymbol
 *
 * ✅ Cursor:
 *   We store info.idLastDownload into FioCursor.lastId
 *   and call fioSetLastId(idLastDownload) AFTER successful import
 */
export async function importFioTransactions(): Promise<FioImportResult> {
  const statement = await fioFetchLast()

  const info = statement?.accountStatement?.info
  const idLastDownload =
    info?.idLastDownload !== undefined && info?.idLastDownload !== null
      ? String(info.idLastDownload)
      : null

  const rawList = statement?.accountStatement?.transactionList?.transaction ?? []
  const normalizedList: NormalizedFioTx[] = rawList
    .map((t) => normalizeFioTx(t))
    .filter((x): x is NormalizedFioTx => x !== null)

  let createdPayments = 0
  let matchedSubs = 0
  let skippedNoVS = 0
  let skippedNoMatch = 0
  let skippedDuplicate = 0
  let skippedInvalidAmount = 0

  for (const tx of normalizedList) {
    const vs = (tx.variableSymbol || '').trim()
    if (!vs) {
      skippedNoVS++
      continue
    }

    // Defensive: only import positive integer CZK amounts
    const amount = Number(tx.amountCzk)
    if (!Number.isFinite(amount) || amount <= 0) {
      skippedInvalidAmount++
      continue
    }

    // match subscription by VS
    const sub = await prisma.subscription.findFirst({
      where: {
        provider: PaymentProvider.FIO,
        variableSymbol: vs,
      },
      select: { id: true, status: true },
    })

    if (!sub) {
      skippedNoMatch++
      continue
    }

    matchedSubs++

    // movementId must exist for idempotency; if missing, skip
    const movementId = tx.movementId != null ? String(tx.movementId) : ''
    if (!movementId) {
      // treat as no match (cannot create providerRef safely)
      skippedNoMatch++
      continue
    }

    const providerRef = `fio:${movementId}`

    // create payment if not already imported
    try {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          provider: PaymentProvider.FIO,
          providerRef,
          amount: Math.round(amount),
          currency: (tx.currency || 'CZK').toUpperCase(),
          status: PaymentStatus.PAID,
          paidAt: tx.bookedAt ?? new Date(),
        },
      })
      createdPayments++
    } catch (e: any) {
      // unique violation => already imported
      if (e?.code === 'P2002') {
        skippedDuplicate++
      } else {
        throw e
      }
    }

    // ensure subscription ACTIVE (if not canceled)
    if (sub.status !== SubscriptionStatus.CANCELED) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          // clear bank timeline fields on successful payment
          tempAccessUntil: null,
          graceUntil: null,
          reminderSentAt: null,
          reminderCount: 0,
        },
      })
    }
  }

  // Store cursor + inform Fio we processed up to idLastDownload
  await prisma.fioCursor.upsert({
    where: { id: 1 },
    create: { id: 1, lastId: idLastDownload },
    update: { lastId: idLastDownload },
  })

  if (idLastDownload) {
    // Important: only set last-id after successful processing
    await fioSetLastId(idLastDownload)
  }

  return {
    ok: true,
    fetched: rawList.length,
    normalized: normalizedList.length,
    createdPayments,
    matchedSubs,
    skippedNoVS,
    skippedNoMatch,
    skippedDuplicate,
    skippedInvalidAmount,
    lastDownloadId: idLastDownload,
  }
}