/**
 * Remove Payment rows with providerRef starting with 'cs_' (Stripe checkout session IDs).
 * These were incorrectly created by authExtra and double-count the first payment
 * (invoice.paid webhook already creates the correct Payment with in_ invoice id).
 *
 * Usage: cd backend && npx ts-node scripts/remove-cs-payments.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const csPayments = await prisma.payment.findMany({
    where: { provider: 'STRIPE', providerRef: { startsWith: 'cs_' } },
    select: { id: true, providerRef: true, amount: true, paidAt: true },
  })

  const totalCzk = csPayments.reduce((s, p) => s + (p.amount || 0), 0)

  console.log('Found', csPayments.length, 'Payment rows with cs_ (checkout session) providerRef')
  console.log('Sum:', totalCzk, 'CZK')
  if (csPayments.length === 0) {
    console.log('Nothing to remove.')
    return
  }

  if (dryRun) {
    console.log('\nDRY RUN – no changes. Remove --dry-run to delete.')
    csPayments.slice(0, 10).forEach((p) => console.log('  ', p.providerRef, p.amount, 'CZK'))
    if (csPayments.length > 10) console.log('  ... and', csPayments.length - 10, 'more')
    return
  }

  const result = await prisma.payment.deleteMany({
    where: { provider: 'STRIPE', providerRef: { startsWith: 'cs_' } },
  })

  console.log('\nDeleted', result.count, 'Payment row(s). Total reduced by', totalCzk, 'CZK.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
