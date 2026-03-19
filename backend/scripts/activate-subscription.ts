#!/usr/bin/env ts-node
/**
 * Activate a subscription by ID (repair FIO payment mismatch).
 * Usage:
 *   npx ts-node scripts/activate-subscription.ts <subscriptionId>
 *   npx ts-node scripts/activate-subscription.ts list   # list PENDING FIO subscriptions
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const arg = process.argv[2]?.trim()
const prisma = new PrismaClient()

async function listPending() {
  const subs = await prisma.subscription.findMany({
    where: { status: 'PENDING', provider: 'FIO' },
    select: {
      id: true,
      variableSymbol: true,
      createdAt: true,
      user: { select: { email: true } },
      animal: { select: { jmeno: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  if (subs.length === 0) {
    console.log('No PENDING FIO subscriptions found.')
    return
  }
  console.log('PENDING FIO subscriptions (run with id to activate):\n')
  for (const s of subs) {
    const paid = await prisma.payment.findFirst({
      where: { subscriptionId: s.id, status: 'PAID' },
      select: { paidAt: true, amount: true },
    })
    console.log(
      `  ${s.id}\n    VS: ${s.variableSymbol || '—'} | ${s.user?.email || '—'} | ${s.animal?.jmeno || s.animal?.name || '—'}`,
    )
    if (paid) console.log(`    Payment: ${paid.amount} Kč @ ${paid.paidAt?.toISOString().slice(0, 10)}`)
    console.log()
  }
}

async function activate(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, status: true, variableSymbol: true, provider: true },
  })
  if (!sub) {
    console.error('Subscription not found:', subscriptionId)
    process.exit(1)
  }
  if (sub.status === 'ACTIVE') {
    console.log('Already ACTIVE:', subscriptionId)
    return
  }
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'ACTIVE' },
  })
  console.log('Activated:', subscriptionId, '(was', sub.status + ', provider:', sub.provider + ')')
}

async function main() {
  if (!arg) {
    console.error('Usage: npx ts-node scripts/activate-subscription.ts <subscriptionId|list>')
    process.exit(1)
  }
  if (arg.toLowerCase() === 'list') {
    await listPending()
  } else {
    await activate(arg)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
