// backend/src/services/monthlyStatsEmail.ts
/**
 * Monthly statistics email: total income, prospected monthly income, STRIPE/FIO chart.
 * Sent to STATS_EMAIL_RECIPIENT (e.g. sh@bluedrm.com) on the 1st of each month.
 */
import { prisma } from '../prisma'
import { sendEmail } from './email'
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

const statsPaymentWhere = {
  OR: [
    { provider: PaymentProvider.FIO },
    { provider: PaymentProvider.STRIPE, providerRef: { startsWith: 'in_' } },
  ],
}

function lastMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))
  return { from, to }
}

function monthLabel(d: Date): string {
  const names = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
  return `${names[d.getMonth()]} ${d.getFullYear()}`
}

async function getTotalIncome(from: Date, to: Date): Promise<number> {
  const paymentWhere = {
    AND: [
      statsPaymentWhere,
      { status: PaymentStatus.PAID },
      { OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, createdAt: { gte: from, lt: to } }] } as any,
    ],
  }
  const pledgeWhere = {
    status: PaymentStatus.PAID,
    createdAt: { gte: from, lt: to },
  }

  const [subPayments, pledgePayments] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      select: { amount: true },
    }),
    prisma.pledgePayment.findMany({
      where: pledgeWhere as any,
      select: { amount: true },
    }),
  ])

  const subSum = subPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const pledgeSum = pledgePayments.reduce((s, p) => s + (p.amount ?? 0), 0)
  return subSum + pledgeSum
}

async function getProspectedMonthlyIncome(): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      OR: [{ canceledAt: null }, { canceledAt: { gt: new Date() } }],
    },
    select: { monthlyAmount: true, currency: true },
  })
  return subs.filter((s) => s.currency === 'CZK').reduce((s, r) => s + (r.monthlyAmount || 0), 0)
}

async function getMonthlyIncomeByProvider(monthsBack: number): Promise<{ month: string; STRIPE: number; FIO: number }[]> {
  const now = new Date()
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth() - monthsBack, 1))
  const to = new Date()

  const paymentWhere = {
    AND: [
      statsPaymentWhere,
      { status: PaymentStatus.PAID },
      { OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, createdAt: { gte: from, lt: to } }] } as any,
    ],
  }
  const pledgeWhere = {
    status: PaymentStatus.PAID,
    createdAt: { gte: from, lt: to },
  }

  const [subPayments, pledgePayments] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      select: { amount: true, provider: true, paidAt: true, createdAt: true },
    }),
    prisma.pledgePayment.findMany({
      where: pledgeWhere as any,
      select: { amount: true, provider: true, createdAt: true },
    }),
  ])

  const monthMap = new Map<string, { stripe: number; fio: number }>()

  for (const p of subPayments) {
    const d = p.paidAt ?? p.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) monthMap.set(key, { stripe: 0, fio: 0 })
    const entry = monthMap.get(key)!
    const prov = String(p.provider ?? '').toUpperCase()
    if (prov === 'STRIPE') entry.stripe += p.amount ?? 0
    else if (prov === 'FIO') entry.fio += p.amount ?? 0
  }

  for (const pp of pledgePayments) {
    const d = pp.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) monthMap.set(key, { stripe: 0, fio: 0 })
    const entry = monthMap.get(key)!
    const prov = String(pp.provider ?? '').toUpperCase()
    if (prov === 'STRIPE') entry.stripe += pp.amount ?? 0
    else if (prov === 'FIO') entry.fio += pp.amount ?? 0
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [y, m] = key.split('-')
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
      return { month: monthLabel(d), STRIPE: v.stripe, FIO: v.fio }
    })
}

async function fetchChartImage(chartData: { month: string; STRIPE: number; FIO: number }[]): Promise<Buffer | null> {
  if (chartData.length === 0) return null

  const config = {
    type: 'bar',
    data: {
      labels: chartData.map((d) => d.month),
      datasets: [
        { label: 'STRIPE (karta)', data: chartData.map((d) => d.STRIPE), backgroundColor: '#635BFF' },
        { label: 'FIO (bankovní převod)', data: chartData.map((d) => d.FIO), backgroundColor: '#0EA5E9' },
      ],
    },
    options: {
      scales: {
        xAxes: [{ stacked: true }],
        yAxes: [{ stacked: true }],
      },
    },
  }

  const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&width=800&height=400`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arr = await res.arrayBuffer()
    return Buffer.from(arr)
  } catch (e) {
    console.error('[monthlyStatsEmail] chart fetch failed', e)
    return null
  }
}

export async function sendMonthlyStatsEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { from, to: toDate } = lastMonthRange()
    const periodLabel = monthLabel(from)

    const [totalIncome, prospectedMonthly, chartData] = await Promise.all([
      getTotalIncome(from, toDate),
      getProspectedMonthlyIncome(),
      getMonthlyIncomeByProvider(6),
    ])

    const chartBuffer = await fetchChartImage(chartData)

    const html = `
      <h2>Měsíční statistiky Dogpoint – ${periodLabel}</h2>
      <p><strong>Celkový příjem (${periodLabel}):</strong> ${totalIncome.toLocaleString('cs-CZ')} Kč</p>
      <p><strong>Očekávaný měsíční příjem (aktivní předplatné):</strong> ${prospectedMonthly.toLocaleString('cs-CZ')} Kč</p>
      ${chartBuffer ? '<p><strong>Příjem podle platební metody (STRIPE / FIO):</strong></p><img src="cid:chart" alt="Graf" style="max-width:100%;" />' : ''}
      <p style="color:#666;font-size:12px;">Tento e-mail byl odeslán automaticky ze systému Dogpoint.</p>
    `

    const attachments: import('./email').EmailAttachment[] = []
    if (chartBuffer) {
      attachments.push({
        filename: 'prijem-stripe-fio.png',
        content: chartBuffer,
        contentType: 'image/png',
        cid: 'chart',
      })
    }

    await sendEmail({
      to,
      subject: `Dogpoint statistiky – ${periodLabel}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    console.log('[monthlyStatsEmail] sent', { to, periodLabel, totalIncome, prospectedMonthly })
    return { ok: true }
  } catch (e: any) {
    console.error('[monthlyStatsEmail] failed', e?.message || e)
    return { ok: false, error: e?.message || String(e) }
  }
}
