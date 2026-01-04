// backend/src/services/taxQuery.ts
import { prisma } from '../prisma'
import { PaymentStatus } from '@prisma/client'

export type TaxPaymentItem = {
  source: 'SUBSCRIPTION' | 'PLEDGE'
  paidAt: Date
  amount: number
  currency: string
  provider?: string | null
  note?: string | null
}

export type TaxRecipient = {
  userId: string
  email: string
  taxProfile: any
  items: TaxPaymentItem[]
  totalCzk: number
}

export type LoadTaxRecipientsOptions = {
  year?: number
  includePledges?: boolean
  // admin filters
  emails?: string[]
  userIds?: string[]
  limit?: number
}

function yearRange(year: number) {
  const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
  const to = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))
  return { from, to }
}

function normEmails(list?: string[]) {
  return (list ?? [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean)
}

function normIds(list?: string[]) {
  return (list ?? []).map((s) => String(s).trim()).filter(Boolean)
}

/**
 * Recipients = users with TaxProfile AND at least one PAID payment in the year.
 * Includes Subscription payments + optional Pledge payments by matching email.
 *
 * Supports admin filters:
 *  - emails: only these recipient emails
 *  - userIds: only these users
 *  - limit: cap result size (useful for safe testing)
 */
export async function loadTaxRecipients(
  yearOrOpts: number | LoadTaxRecipientsOptions = 2025,
  includePledgesLegacy = true,
): Promise<TaxRecipient[]> {
  // Backward compatible signature:
  //   loadTaxRecipients(2025, true)
  // New signature:
  //   loadTaxRecipients({ year: 2025, emails: [...], limit: 10 })
  const opts: LoadTaxRecipientsOptions =
    typeof yearOrOpts === 'number'
      ? { year: yearOrOpts, includePledges: includePledgesLegacy }
      : { ...yearOrOpts }

  const year = opts.year ?? 2025
  const includePledges = opts.includePledges ?? true
  const emails = normEmails(opts.emails)
  const userIds = normIds(opts.userIds)
  const limit = typeof opts.limit === 'number' && opts.limit > 0 ? Math.floor(opts.limit) : undefined

  const { from, to } = yearRange(year)

  // Admin filter OR (emails/userIds). If neither given -> no additional filtering.
  const adminFilterOR =
    emails.length || userIds.length
      ? {
          OR: [
            ...(emails.length ? [{ email: { in: emails } }] : []),
            ...(userIds.length ? [{ id: { in: userIds } }] : []),
          ],
        }
      : {}

  // 1) Users with taxProfile + subscription payments in year
  const users = await prisma.user.findMany({
    where: {
      ...adminFilterOR,
      taxProfile: { isNot: null },
      subscriptions: {
        some: {
          payments: {
            some: {
              status: PaymentStatus.PAID,
              paidAt: { gte: from, lt: to },
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      taxProfile: true,
      subscriptions: {
        select: {
          currency: true,
          provider: true,
          message: true,
          payments: {
            where: {
              status: PaymentStatus.PAID,
              paidAt: { gte: from, lt: to },
            },
            select: {
              amount: true,
              currency: true,
              paidAt: true,
              provider: true,
            },
            orderBy: { paidAt: 'asc' },
          },
        },
      },
    },
    orderBy: { email: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  // Flatten subscription payments
  const base: TaxRecipient[] = users.map((u) => {
    const items: TaxPaymentItem[] = []
    for (const s of u.subscriptions) {
      for (const p of s.payments) {
        if (!p.paidAt) continue
        items.push({
          source: 'SUBSCRIPTION',
          paidAt: p.paidAt,
          amount: p.amount,
          currency: p.currency ?? 'CZK',
          provider: p.provider,
          note: s.message ?? null,
        })
      }
    }

    const totalCzk = items
      .filter((x) => (x.currency || 'CZK') === 'CZK')
      .reduce((sum, x) => sum + (x.amount || 0), 0)

    return {
      userId: u.id,
      email: u.email,
      taxProfile: u.taxProfile,
      items,
      totalCzk,
    }
  })

  if (!includePledges) return base

  // 2) OPTIONAL: include PledgePayment donations by matching email (Pledge has no userId)
  const baseEmails = base.map((r) => r.email)
  if (baseEmails.length === 0) return base

  const pledges = await prisma.pledge.findMany({
    where: { email: { in: baseEmails } },
    select: {
      email: true,
      payments: {
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: from, lt: to },
        },
        select: {
          amount: true,
          currency: true,
          paidAt: true,
          provider: true,
        },
        orderBy: { paidAt: 'asc' },
      },
    },
  })

  const pledgeByEmail = new Map<string, TaxPaymentItem[]>()
  for (const p of pledges) {
    const list: TaxPaymentItem[] = pledgeByEmail.get(p.email) ?? []
    for (const pay of p.payments) {
      if (!pay.paidAt) continue
      list.push({
        source: 'PLEDGE',
        paidAt: pay.paidAt,
        amount: pay.amount,
        currency: pay.currency ?? 'CZK',
        provider: pay.provider ?? null,
      })
    }
    pledgeByEmail.set(p.email, list)
  }

  // Merge pledges into recipients + recompute totals
  for (const r of base) {
    const extra = pledgeByEmail.get(r.email) ?? []
    if (extra.length) {
      r.items.push(...extra)
      r.items.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
      r.totalCzk = r.items
        .filter((x) => (x.currency || 'CZK') === 'CZK')
        .reduce((sum, x) => sum + (x.amount || 0), 0)
    }
  }

  // Keep only recipients who still have items (safety)
  return base.filter((r) => r.items.length > 0)
}