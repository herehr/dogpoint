// backend/src/jobs/monthlyStatsCron.ts
/**
 * Sends monthly statistics email on the 1st of each month.
 * Recipient: STATS_EMAIL_RECIPIENT (e.g. sh@bluedrm.com)
 */
import cron from 'node-cron'
import { sendMonthlyStatsEmail } from '../services/monthlyStatsEmail'

export function startMonthlyStatsCron() {
  const recipient = process.env.STATS_EMAIL_RECIPIENT?.trim()
  if (!recipient) {
    console.log('[MONTHLY-STATS CRON] disabled (STATS_EMAIL_RECIPIENT not set)')
    return
  }

  // Run on 1st of each month at 8:00
  const schedule = process.env.STATS_CRON_SCHEDULE || '0 8 1 * *'
  console.log(`[MONTHLY-STATS CRON] scheduled: ${schedule} -> ${recipient}`)

  cron.schedule(schedule, () => {
    sendMonthlyStatsEmail(recipient).catch((e: any) => {
      console.error('[MONTHLY-STATS CRON] error', e?.message || e)
    })
  })
}
