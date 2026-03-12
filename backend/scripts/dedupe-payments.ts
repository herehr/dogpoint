/**
 * Remove duplicate Payment rows (same provider + providerRef).
 * Keeps the row with earliest paidAt (or createdAt).
 * Run: npx ts-node -r tsconfig-paths/register scripts/dedupe-payments.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find duplicates: same (provider, providerRef)
  const dupes = await prisma.$queryRaw<
    { provider: string; providerRef: string; cnt: bigint }[]
  >`
    SELECT "provider", "providerRef", COUNT(*) as cnt
    FROM "Payment"
    WHERE "providerRef" IS NOT NULL
    GROUP BY "provider", "providerRef"
    HAVING COUNT(*) > 1
  `

  if (dupes.length === 0) {
    console.log('No duplicate Payment rows found.')
    return
  }

  console.log(`Found ${dupes.length} duplicate (provider, providerRef) groups:`)
  dupes.forEach((d) => console.log(`  ${d.provider} / ${d.providerRef} (${d.cnt} rows)`))

  let totalDeleted = 0
  for (const { provider, providerRef } of dupes) {
    // Get all rows for this (provider, providerRef), ordered by paidAt, createdAt
    const rows = await prisma.payment.findMany({
      where: { provider: provider as any, providerRef },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, amount: true, paidAt: true },
    })

    // Keep first, delete rest
    const toDelete = rows.slice(1)
    for (const row of toDelete) {
      await prisma.payment.delete({ where: { id: row.id } })
      totalDeleted++
      console.log(`  Deleted ${row.id} (${row.amount} CZK)`)
    }
  }

  console.log(`\nRemoved ${totalDeleted} duplicate Payment row(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
