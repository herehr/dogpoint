// backend/src/services/fioImport.ts
import { prisma } from '../prisma'
import { fioFetchPeriod, normalizeFioTx, type NormalizedFioTx } from './fioClient'
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

export type FioImportResult = {
  ok: true
  from: string
  to: string
  fetched: number
  normalized: number
  incoming?: number
  createdPayments: number
  matchedSubs: number
  skippedNoVS: number
  skippedNoMatch: number
  skippedDuplicate: number
  /** Count of FIO subscriptions with VS in DB (for debugging) */
  fioSubsWithVS?: number
  /** Sample VS that had no match (595* = adoption format) – for debugging */
  sampleNoMatchVS?: string[]
}

/** Normalize VS for matching: remove spaces, strip leading zeros */
function normalizeVS(s: string | null | undefined): string {
  const t = (s ?? '').replace(/\s/g, '').trim()
  const n = t.replace(/^0+/, '')
  return n || '0'
}

export async function importFioTransactions(params: { fromISO: string; toISO: string }): Promise<FioImportResult> {
  const { fromISO, toISO } = params

  const statement = await fioFetchPeriod(fromISO, toISO)

  const rawList = statement?.accountStatement?.transactionList?.transaction ?? []
  const normalizedList: NormalizedFioTx[] = rawList
    .map((t) => normalizeFioTx(t))
    .filter((x): x is NormalizedFioTx => x !== null)

  // Only INCOMING (positive amount) – adoptions are money received
  const incomingList = normalizedList.filter((tx) => tx.amountCzk > 0)

  // Build map: normalized VS -> subscription (for flexible matching)
  const fioSubs = await prisma.subscription.findMany({
    where: { provider: PaymentProvider.FIO, variableSymbol: { not: null } },
    select: { id: true, status: true, variableSymbol: true },
  })
  const vsToSub = new Map<string, (typeof fioSubs)[0]>()
  for (const s of fioSubs) {
    const vs = s.variableSymbol || ''
    if (vs) {
      vsToSub.set(vs, s)
      vsToSub.set(normalizeVS(vs), s)
    }
  }

  let createdPayments = 0
  let matchedSubs = 0
  let skippedNoVS = 0
  let skippedNoMatch = 0
  let skippedDuplicate = 0
  const noMatchVSamples: string[] = []

  for (const tx of incomingList) {
    const vs = normalizeVS(tx.variableSymbol)
    if (!vs) {
      skippedNoVS++
      continue
    }

    const sub = vsToSub.get(vs)
    if (!sub) {
      skippedNoMatch++
      if (vs.startsWith('595') && noMatchVSamples.length < 5) {
        noMatchVSamples.push(vs)
      }
      continue
    }

    matchedSubs++

    const providerRef = `fio:${tx.movementId}`

    // Dedupe by subscription + amount + paidAt date (FIO can return different movementIds for same tx)
    const d = tx.bookedAt
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    const existingSameDay = await prisma.payment.findFirst({
      where: {
        subscriptionId: sub.id,
        provider: PaymentProvider.FIO,
        amount: tx.amountCzk,
        paidAt: { gte: dayStart, lt: dayEnd },
      },
    })
    if (existingSameDay) {
      skippedDuplicate++
      continue
    }

    // create payment if not already imported (providerRef unique also catches same movementId)
    try {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          provider: PaymentProvider.FIO,
          providerRef,
          amount: tx.amountCzk,
          currency: (tx.currency || 'CZK').toUpperCase(),
          status: PaymentStatus.PAID,
          paidAt: tx.bookedAt,
        },
      })
      createdPayments++
    } catch (e: any) {
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
          // clear bank timeline fields on successful payment (only if fields exist in your DB)
          // If your Prisma schema doesn't have these fields yet, add them there too.
          tempAccessUntil: null as any,
          graceUntil: null as any,
          reminderSentAt: null as any,
          reminderCount: 0 as any,
        } as any,
      })
    }
  }

  return {
    ok: true,
    from: fromISO,
    to: toISO,
    fetched: rawList.length,
    normalized: normalizedList.length,
    incoming: incomingList.length,
    createdPayments,
    matchedSubs,
    skippedNoVS,
    skippedNoMatch,
    skippedDuplicate,
    fioSubsWithVS: fioSubs.length,
    sampleNoMatchVS: noMatchVSamples.length ? noMatchVSamples : undefined,
  }
}