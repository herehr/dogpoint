// backend/src/jobs/fioCron.ts
import cron from 'node-cron'
import { prisma } from '../prisma'
import { importFioTransactions } from '../services/fioImport'

// Any stable int; must stay constant across instances
const LOCK_KEY = 912345678

async function tryAdvisoryLock(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked
  `
  return !!rows?.[0]?.locked
}

async function unlockAdvisoryLock(): Promise<void> {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`
}

function withTimeout<T>(p: Promise<T>, ms: number, label = 'timeout'): Promise<T> {
  let t: NodeJS.Timeout | undefined
  const timeout = new Promise<T>((_resolve, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms)
  })
  return Promise.race([p, timeout]).finally(() => t && clearTimeout(t)) as Promise<T>
}

export function startFioCron() {
  const schedule = process.env.FIO_CRON || '0 3 * * *' // daily 03:00 UTC
  const runOnInit = (process.env.FIO_RUN_ON_INIT || '').toLowerCase() === 'true'
  const timeoutMs = Number(process.env.FIO_IMPORT_TIMEOUT_MS || 10 * 60 * 1000) // 10 min default

  if (!cron.validate(schedule)) {
    console.warn(`[FIO CRON] invalid schedule "${schedule}", cron disabled`)
    return
  }

  console.log(`[FIO CRON] scheduled: ${schedule} (runOnInit=${runOnInit})`)

  const runOnce = async () => {
    const locked = await tryAdvisoryLock()
    if (!locked) {
      console.log('[FIO CRON] skipped (another instance holds lock)')
      return
    }

    try {
      console.log('[FIO CRON] import start')
      const result = await withTimeout(importFioTransactions(), timeoutMs, 'FIO import timeout')
      console.log('[FIO CRON] import done', result)
    } catch (e: any) {
      console.error('[FIO CRON] import error', e?.message || e)
    } finally {
      await unlockAdvisoryLock().catch(() => {})
    }
  }

  if (runOnInit) {
    runOnce().catch(() => {})
  }

  cron.schedule(schedule, () => {
    runOnce().catch(() => {})
  })
}