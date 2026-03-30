// backend/src/jobs/stripeSyncCron.ts
/**
 * Daily (configurable) Stripe invoice → Payment table sync.
 * Same logic as POST /api/admin/stripe-sync-payments / runStripeSync().
 */
import cron from 'node-cron'
import { withPgAdvisoryLock } from './pgAdvisoryLock'
import { runStripeSync } from '../services/repairImportPayments'

const ADVISORY_LOCK_KEY = 991125

export function startStripeSyncCron() {
  const enabled = String(process.env.STRIPE_SYNC_CRON_ENABLED || 'true').toLowerCase() !== 'false'
  if (!enabled) {
    console.log('[STRIPE SYNC CRON] disabled via STRIPE_SYNC_CRON_ENABLED=false')
    return
  }

  const schedule = process.env.STRIPE_SYNC_CRON_SCHEDULE || '30 6 * * *'
  const runOnInit = String(process.env.STRIPE_SYNC_CRON_RUN_ON_INIT || 'false').toLowerCase() === 'true'

  console.log(`[STRIPE SYNC CRON] scheduled: ${schedule} (runOnInit=${runOnInit}, UTC server time)`)

  const job = async () => {
    const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET
    if (!key) {
      console.warn('[STRIPE SYNC CRON] missing STRIPE_SECRET_KEY — skipping')
      return
    }

    console.log('[STRIPE SYNC CRON] start')
    const res = await withPgAdvisoryLock(ADVISORY_LOCK_KEY, async () => runStripeSync())

    if (res === null) {
      console.log('[STRIPE SYNC CRON] skipped (lock not acquired)')
      return
    }

    console.log(`[STRIPE SYNC CRON] ok created=${res.created}`)
  }

  cron.schedule(schedule, () => {
    job().catch((e: any) => {
      console.error('[STRIPE SYNC CRON] error', e?.message || e)
    })
  })

  if (runOnInit) {
    job().catch((e: any) => console.error('[STRIPE SYNC CRON] init error', e?.message || e))
  }
}
