#!/usr/bin/env npx ts-node
/**
 * One-time repair: backup payments, then import all Stripe + FIO payments
 * from 2025-12-01 to today. Idempotent (no duplicate payments).
 *
 * Usage: cd backend && npx ts-node scripts/repair-import-payments.ts
 *
 * Requires: .env with DATABASE_URL, FIO_TOKEN, STRIPE_SECRET_KEY
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../src/prisma'
import {
  backupPayments,
  runFioImport,
  runStripeSync,
} from '../src/services/repairImportPayments'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  console.log('=== Repair import: backup + FIO + Stripe ===')
  console.log(`Date range: 2025-12-01 .. ${todayISO()}`)
  console.log('')

  const backup = await backupPayments()
  const backupDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  const filepath = path.join(backupDir, `payments-backup-${todayISO()}.json`)
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8')
  console.log(`[backup] Saved ${backup.length} payments to ${filepath}`)
  console.log('')

  const fioResult = await runFioImport()
  console.log(`[FIO] Created: ${fioResult.created}`)
  console.log('')

  const stripeResult = await runStripeSync()
  console.log(`[Stripe] Created: ${stripeResult.created}`)
  console.log('')

  console.log('=== Done ===')
  console.log(`Backup: ${filepath}`)
  console.log(`FIO created: ${fioResult.created}`)
  console.log(`Stripe created: ${stripeResult.created}`)
  console.log(`Total new payments: ${fioResult.created + stripeResult.created}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
