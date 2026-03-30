// backend/src/jobs/fioCron.ts
import cron from 'node-cron'
import { importFioTransactions } from '../services/fioImport'
import { withPgAdvisoryLock } from './pgAdvisoryLock'

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startFioCron() {
  const enabled = String(process.env.FIO_CRON_ENABLED || 'true').toLowerCase() !== 'false'
  if (!enabled) {
    console.log('[FIO CRON] disabled via FIO_CRON_ENABLED=false')
    return
  }

  const schedule = process.env.FIO_CRON_SCHEDULE || '0 6 * * *'
  const runOnInit = String(process.env.FIO_CRON_RUN_ON_INIT || 'false').toLowerCase() === 'true'

  const lookbackDays = Math.max(1, Number(process.env.FIO_CRON_LOOKBACK_DAYS || 7))
  console.log(`[FIO CRON] scheduled: ${schedule} (runOnInit=${runOnInit}) lookbackDays=${lookbackDays} (default: once/day 6:00)`)

  const job = async () => {
    const token = process.env.FIO_TOKEN
    if (!token) {
      console.warn('[FIO CRON] missing FIO_TOKEN - skipping')
      return
    }

    // Rolling window (must be <= 90d for no-auth behavior)
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - lookbackDays)

    const fromISO = isoDate(from)
    const toISO = isoDate(to)

    console.log(`[FIO CRON] import start (period ${fromISO}..${toISO})`)

    const res = await withPgAdvisoryLock(991122, async () => {
      return await importFioTransactions({ fromISO, toISO })
    })

    if (!res) {
      console.log('[FIO CRON] skipped (lock not acquired)')
      return
    }

    console.log(
      `[FIO CRON] import ok fetched=${res.fetched} normalized=${res.normalized} created=${res.createdPayments} matchedSubs=${res.matchedSubs} dup=${res.skippedDuplicate} noVS=${res.skippedNoVS} noMatch=${res.skippedNoMatch}`
    )
  }

  cron.schedule(schedule, () => {
    job().catch((e: any) => {
      console.error('[FIO CRON] import error', e?.message || e)
    })
  })

  if (runOnInit) {
    job().catch((e: any) => console.error('[FIO CRON] init error', e?.message || e))
  }
}