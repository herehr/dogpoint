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

  // Fetch Payment records (STRIPE, PAID) - providerRef = invoice id
  const payments = await prisma.payment.findMany({
    where: { provider: 'STRIPE', status: 'PAID' },
    select: { providerRef: true, amount: true },
  })

  const dbIds = new Set(payments.map((p) => p.providerRef).filter(Boolean))
  const totalDbCzk = payments.reduce((s, p) => s + (p.amount || 0), 0)

  // Missing: in CSV (paid) but not in DB
  const missing = paidInvoices.filter((r) => r.id && !dbIds.has(r.id))

  // Extra: in DB but not in CSV (could be from different export range)
  const extra = payments.filter((p) => p.providerRef && !paidIds.has(p.providerRef))

  console.log('=== Stripe invoices vs Payment table ===\n')
  console.log('CSV (paid):', paidInvoices.length, 'invoices,', totalCsvPaid.toFixed(2), 'CZK')
  console.log('DB (STRIPE PAID):', payments.length, 'payments,', totalDbCzk, 'CZK')
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
  console.log('In DB but not in CSV (possibly different date range):', extra.length)
  if (extra.length > 0 && extra.length <= 20) {
    extra.forEach((p) => console.log('    ', p.providerRef, p.amount, 'CZK'))
  } else if (extra.length > 20) {
    console.log('  (first 10):', extra.slice(0, 10).map((p) => p.providerRef).join(', '))
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
