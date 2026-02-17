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
  createdPayments: number
  matchedSubs: number
  skippedNoVS: number
  skippedNoMatch: number
  skippedDuplicate: number
}

export async function importFioTransactions(params: { fromISO: string; toISO: string }): Promise<FioImportResult> {
  const { fromISO, toISO } = params

  const statement = await fioFetchPeriod(fromISO, toISO)

  const rawList = statement?.accountStatement?.transactionList?.transaction ?? []
  const normalizedList: NormalizedFioTx[] = rawList
    .map((t) => normalizeFioTx(t))
    .filter((x): x is NormalizedFioTx => x !== null)

  let createdPayments = 0
  let matchedSubs = 0
  let skippedNoVS = 0
  let skippedNoMatch = 0
  let skippedDuplicate = 0

  /** Normalize variable symbol for matching (strip leading zeros). FIO may send "00012345", we store "12345". */
  function normalizeVs(s: string): string {
    const t = String(s || '').trim()
    const n = t.replace(/^0+/, '')
    return n || '0'
  }

  // Build lookup: exact VS and normalized VS -> subscription (for flexible matching)
  const fioSubs = await prisma.subscription.findMany({
    where: { provider: PaymentProvider.FIO, variableSymbol: { not: null } },
    select: { id: true, status: true, variableSymbol: true },
  })
  const subByVs = new Map<string, { id: string; status: string }>()
  for (const s of fioSubs) {
    const vs = s.variableSymbol || ''
    if (vs) {
      subByVs.set(vs, { id: s.id, status: s.status })
      subByVs.set(normalizeVs(vs), { id: s.id, status: s.status })
    }
  }

  for (const tx of normalizedList) {
    const vs = (tx.variableSymbol || '').trim()
    if (!vs) {
      skippedNoVS++
      continue
    }

    // match: exact first, then normalized (FIO may send "00012345", we store "12345")
    const sub = subByVs.get(vs) ?? subByVs.get(normalizeVs(vs)) ?? null

    if (!sub) {
      skippedNoMatch++
      continue
    }

    matchedSubs++

    const providerRef = `fio:${tx.movementId}`

    // create payment if not already imported
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
    createdPayments,
    matchedSubs,
    skippedNoVS,
    skippedNoMatch,
    skippedDuplicate,
  }
}