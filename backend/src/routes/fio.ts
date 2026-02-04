// backend/src/routes/fio.ts
import { Router, type Request, type Response } from 'express'
import { importFioTransactions } from '../services/fioImport'

const router = Router()

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODateOrNull(s: unknown): string | null {
  const v = String(s || '').trim()
  if (!v) return null
  // very light validation YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}

/**
 * GET /api/fio/import?from=2026-01-09&to=2026-01-16
 * - If from/to not provided, defaults to lookback (env FIO_CRON_LOOKBACK_DAYS or 7)
 */
router.get('/import', async (req: Request, res: Response) => {
  try {
    const lookbackDays = Math.max(1, Number(process.env.FIO_CRON_LOOKBACK_DAYS || 7))

    const toQ = parseISODateOrNull(req.query.to)
    const fromQ = parseISODateOrNull(req.query.from)

    const to = toQ || isoDate(new Date())
    const from =
      fromQ ||
      (() => {
        const d = new Date()
        d.setDate(d.getDate() - lookbackDays)
        return isoDate(d)
      })()

    const result = await importFioTransactions({ fromISO: from, toISO: to })
    return res.json(result)
  } catch (e: any) {
    console.error('[fio route] import error', e?.message || e)
    return res.status(500).json({ error: 'import failed', detail: e?.message || String(e) })
  }
})

export default router