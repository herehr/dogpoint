/**
 * Compare Stripe invoices CSV with imported Payment records.
 * Usage: cd backend && npx ts-node scripts/compare-stripe-invoices.ts /path/to/invoices.csv
 *
 * Requires: .env with DATABASE_URL
 */
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      row[h.trim()] = values[j] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      current += c
    } else if (c === ',') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

async function main() {
  const csvPath = process.argv[2] || path.join(process.env.HOME || '', 'Downloads', 'invoices.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('Usage: npx ts-node scripts/compare-stripe-invoices.ts /path/to/invoices.csv')
    console.error('File not found:', csvPath)
    process.exit(1)
  }

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)

  // CSV columns: id, Status, Amount Paid, Subscription
  const paidInvoices = rows.filter((r) => String(r.Status || '').toLowerCase() === 'paid')
  const paidIds = new Set(paidInvoices.map((r) => r.id).filter(Boolean))

  const totalCsvPaid = paidInvoices.reduce((s, r) => {
    const amt = parseFloat(String(r['Amount Paid'] || r['Amount Paid'] || '0').replace(/,/g, ''))
    return s + (Number.isFinite(amt) ? amt : 0)
  }, 0)

  // Fetch ALL Payment records (STRIPE + FIO)
  const allPayments = await prisma.payment.findMany({
    where: { status: 'PAID' },
    select: { provider: true, providerRef: true, amount: true },
  })

  const stripePayments = allPayments.filter((p) => p.provider === 'STRIPE')
  const fioPayments = allPayments.filter((p) => p.provider === 'FIO')
  const stripeInvoices = stripePayments.filter((p) => p.providerRef?.startsWith('in_'))
  const stripeCsSessions = stripePayments.filter((p) => p.providerRef?.startsWith('cs_'))

  const dbIds = new Set(stripeInvoices.map((p) => p.providerRef).filter(Boolean))
  const totalStripeCzk = stripePayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalFioCzk = fioPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalDbCzk = totalStripeCzk + totalFioCzk
  const csSumCzk = stripeCsSessions.reduce((s, p) => s + (p.amount || 0), 0)

  // Missing: in CSV (paid) but not in DB
  const missing = paidInvoices.filter((r) => r.id && !dbIds.has(r.id))

  // Extra Stripe: in DB but not in CSV (cs_ = wrong/duplicate, in_ = maybe different export range)
  const extraInvoices = stripeInvoices.filter((p) => p.providerRef && !paidIds.has(p.providerRef))

  console.log('=== Stripe CSV vs Payment table ===\n')
  console.log('CSV (paid):', paidInvoices.length, 'invoices,', totalCsvPaid.toFixed(0), 'CZK')
  console.log('')
  console.log('DB breakdown:')
  console.log('  STRIPE (in_ invoices):', stripeInvoices.length, 'payments,', stripeInvoices.reduce((s, p) => s + (p.amount || 0), 0), 'CZK')
  console.log('  STRIPE (cs_ sessions – WRONG, duplicates):', stripeCsSessions.length, 'payments,', csSumCzk, 'CZK')
  console.log('  FIO:', fioPayments.length, 'payments,', totalFioCzk, 'CZK')
  console.log('  TOTAL DB:', allPayments.length, 'payments,', totalDbCzk, 'CZK')
  console.log('')
  console.log('Expected Stripe total (from CSV):', totalCsvPaid.toFixed(0), 'CZK')
  console.log('DB has', totalStripeCzk, 'CZK from Stripe. Diff:', (totalStripeCzk - totalCsvPaid).toFixed(0), 'CZK')
  if (stripeCsSessions.length > 0) {
    console.log('')
    console.log('>>> Remove cs_ payments to fix double-counting. Run: npx ts-node scripts/remove-cs-payments.ts')
  }
  console.log('')
  console.log('Missing in DB (in CSV but not imported):', missing.length)
  if (missing.length > 0) {
    const missingSum = missing.reduce((s, r) => {
      const amt = parseFloat(String(r['Amount Paid'] || '0').replace(/,/g, ''))
      return s + (Number.isFinite(amt) ? amt : 0)
    }, 0)
    console.log('  Sum of missing:', missingSum.toFixed(2), 'CZK')
    console.log('  Sample (first 10):')
    missing.slice(0, 10).forEach((r) => {
      const sub = r.Subscription || ''
      const amt = r['Amount Paid'] || ''
      const date = r['Date (UTC)'] || ''
      console.log('    ', r.id, '|', amt, 'CZK |', date, '|', sub)
    })
  }
  console.log('')
  console.log('In DB (in_) but not in CSV (different export range?):', extraInvoices.length)
  if (extraInvoices.length > 0 && extraInvoices.length <= 20) {
    extraInvoices.forEach((p) => console.log('    ', p.providerRef, p.amount, 'CZK'))
  } else if (extraInvoices.length > 20) {
    console.log('  (first 10):', extraInvoices.slice(0, 10).map((p) => p.providerRef).join(', '))
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
