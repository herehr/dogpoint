#!/usr/bin/env npx ts-node
/**
 * Deduplicate FIO payments: same subscription + amount + paidAt date imported multiple times.
 * Keeps the earliest created record per group, deletes the rest.
 *
 * Usage: cd backend && npx ts-node scripts/dedup-fio-payments.ts [--dry-run]
 */

import { prisma } from '../src/prisma'
import { PaymentProvider } from '@prisma/client'

function toDateKey(d: Date | null): string {
  if (!d) return 'null'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[dedup-fio] DRY RUN – no deletions')

  const payments = await prisma.payment.findMany({
    where: { provider: PaymentProvider.FIO },
    orderBy: { createdAt: 'asc' },
    select: { id: true, subscriptionId: true, amount: true, paidAt: true, createdAt: true },
  })

  const groups = new Map<string, typeof payments>()
  for (const p of payments) {
    const key = `${p.subscriptionId}|${p.amount}|${toDateKey(p.paidAt)}`
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  let totalDeleted = 0
  for (const [key, list] of groups) {
    if (list.length <= 1) continue
    const [keep, ...toDelete] = list
    totalDeleted += toDelete.length
    console.log(
      `[dedup-fio] ${key}: keeping ${keep.id} (${keep.createdAt.toISOString()}), deleting ${toDelete.length}: ${toDelete.map((x) => x.id).join(', ')}`
    )
    if (!dryRun) {
      await prisma.payment.deleteMany({ where: { id: { in: toDelete.map((x) => x.id) } } })
    }
  }

  console.log(`[dedup-fio] done. Duplicate groups: ${[...groups.values()].filter((g) => g.length > 1).length}, payments to delete: ${totalDeleted}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
