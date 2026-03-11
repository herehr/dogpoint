/**
 * Import Stripe paid invoices from CSV into Payment table.
 * Matches by Subscription.providerRef = invoice.Subscription (sub_xxx).
 * Resolves cs_ (checkout session) -> sub_ via Stripe API when needed.
 *
 * With --create-missing: fetches Stripe subscription, creates User+Subscription from metadata
 * (animalId, customer email), then creates Payment. Requires Stripe metadata from our checkout.
 *
 * Usage: cd backend && npx ts-node scripts/import-stripe-invoices-csv.ts /path/to/invoices.csv [--dry-run] [--create-missing]
 *
 * Requires: .env with DATABASE_URL, STRIPE_SECRET_KEY
 */
import * as fs from 'fs'
import * as path from 'path'
import Stripe from 'stripe'
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
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const createMissing = args.includes('--create-missing')
  const csvPath = args.find((a) => !a.startsWith('--')) || path.join(process.env.HOME || '', 'Downloads', 'invoices.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('Usage: npx ts-node scripts/import-stripe-invoices-csv.ts /path/to/invoices.csv [--dry-run]')
    process.exit(1)
  }

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)
  const paidInvoices = rows.filter((r) => String(r.Status || '').toLowerCase() === 'paid')

  console.log('CSV: %d paid invoices', paidInvoices.length)
  if (dryRun) console.log('DRY RUN - no changes will be made\n')

  // Build map: stripeSubId (sub_xxx) -> our subscription id
  const subs = await prisma.subscription.findMany({
    where: { provider: 'STRIPE' },
    select: { id: true, providerRef: true },
  })

  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
  const stripe = stripeKey ? new Stripe(stripeKey) : null

  const subByStripeRef = new Map<string, string>()
  for (const s of subs) {
    if (!s.providerRef) continue
    if (s.providerRef.startsWith('sub_')) {
      subByStripeRef.set(s.providerRef, s.id)
    } else if (s.providerRef.startsWith('cs_') && stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(s.providerRef, { expand: ['subscription'] })
        const raw = (session as any).subscription
        const subId = typeof raw === 'string' ? raw : raw?.id
        if (subId) {
          subByStripeRef.set(subId, s.id)
          if (!dryRun) {
            await prisma.subscription.update({ where: { id: s.id }, data: { providerRef: subId } as any })
          }
        }
      } catch (e) {
        console.warn('Could not resolve', s.providerRef, (e as Error).message)
      }
    }
  }
  console.log('Subscriptions mappable to Stripe sub_xxx:', subByStripeRef.size)

  let created = 0
  let skippedNoSub = 0
  let skippedExists = 0
  let errors = 0

  for (const inv of paidInvoices) {
    const invoiceId = inv.id?.trim()
    const stripeSubId = inv.Subscription?.trim()
    const amountStr = String(inv['Amount Paid'] || inv.Amount || '0').replace(/,/g, '')
    const amountCzk = Math.round(parseFloat(amountStr) || 0)
    const dateStr = inv['Date (UTC)'] || inv.Date || ''
    const paidAt = dateStr ? new Date(dateStr.replace(' ', 'T') + 'Z') : new Date()

    if (!invoiceId || !stripeSubId || !stripeSubId.startsWith('sub_')) continue

    let ourSubId = subByStripeRef.get(stripeSubId)
    if (!ourSubId && createMissing && stripe) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId, {
          expand: ['customer', 'latest_invoice'],
        })
        const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id
        const customer = customerId ? await stripe.customers.retrieve(customerId) : null
        const email = (customer as any)?.email?.trim()?.toLowerCase()
        let animalId = (stripeSub.metadata as Record<string, string> | null)?.animalId
        if (!animalId) {
          const sessions = await stripe.checkout.sessions.list({ subscription: stripeSubId, limit: 1 })
          const session = sessions.data[0]
          animalId = (session?.metadata as Record<string, string> | null)?.animalId
        }
        if (!email || !animalId) {
          skippedNoSub++
          continue
        }
        let user = await prisma.user.findUnique({ where: { email } })
        if (!user) user = await prisma.user.create({ data: { email, role: 'USER' } as any })
        let sub = await prisma.subscription.findFirst({
          where: { userId: user.id, animalId, provider: 'STRIPE' },
          select: { id: true },
        })
        if (!sub) {
          sub = await prisma.subscription.create({
            data: {
              userId: user.id,
              animalId,
              monthlyAmount: amountCzk || 100,
              currency: 'CZK',
              provider: 'STRIPE',
              providerRef: stripeSubId,
              status: 'ACTIVE',
              startedAt: paidAt,
            } as any,
            select: { id: true },
          })
        }
        ourSubId = sub.id
        subByStripeRef.set(stripeSubId, ourSubId)
      } catch (e) {
        skippedNoSub++
        continue
      }
    }
    if (!ourSubId) {
      skippedNoSub++
      continue
    }

    const existing = await prisma.payment.findFirst({
      where: { subscriptionId: ourSubId, providerRef: invoiceId },
      select: { id: true },
    })
    if (existing) {
      skippedExists++
      continue
    }

    if (!dryRun) {
      try {
        await prisma.payment.create({
          data: {
            subscriptionId: ourSubId,
            provider: 'STRIPE',
            providerRef: invoiceId,
            amount: amountCzk || 1,
            currency: 'CZK',
            status: 'PAID',
            paidAt,
          } as any,
        })
        created++
      } catch (e: any) {
        if (e?.code === 'P2002') skippedExists++
        else {
          errors++
          console.error('Error', invoiceId, e?.message)
        }
      }
    } else {
      created++
    }
  }

  console.log('\nResult:')
  console.log('  Created:', created)
  console.log('  Skipped (already exists):', skippedExists)
  console.log('  Skipped (no matching subscription):', skippedNoSub)
  if (errors > 0) console.log('  Errors:', errors)

  if (skippedNoSub > 0) {
    console.log('\nNote: %d invoices had no Subscription with matching providerRef (sub_xxx)', skippedNoSub)
    const uniqueSubsInCsv = new Set(paidInvoices.map((r) => r.Subscription?.trim()).filter(Boolean))
    console.log('Unique Stripe subscription IDs in CSV:', uniqueSubsInCsv.size)
    console.log('Our Subscription rows with providerRef:', subs.filter((s) => s.providerRef).length)
    console.log('Mapped (sub_xxx -> our sub):', subByStripeRef.size)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
