// backend/src/services/fioClient.ts

const FIO_BASE = 'https://fioapi.fio.cz/v1/rest'

type FioColumnValue<T> = { value: T; name?: string; id?: number } | null

export type FioTransaction = {
  column0?: FioColumnValue<number | string> // date (ms since epoch) OR sometimes string
  column1?: FioColumnValue<number> // amount
  column5?: FioColumnValue<string> // variable symbol (VS)
  column14?: FioColumnValue<string> // currency
  column22?: FioColumnValue<number> // movementId (unique within account)
  column16?: FioColumnValue<string> // message
  column25?: FioColumnValue<string> // comment
}

export type FioStatementResponse = {
  accountStatement: {
    info: {
      accountId: string
      bankId?: string
      currency: string
      iban?: string
      bic?: string
      openingBalance?: number
      closingBalance?: number
      dateStart?: string | number
      dateEnd?: string | number
      idLastDownload?: number
      idFrom?: number
      idTo?: number
    }
    transactionList?: {
      transaction?: FioTransaction[]
    }
  }
}

export type NormalizedFioTx = {
  movementId: string
  bookedAt: Date
  amountCzk: number
  currency: string
  variableSymbol: string | null
  message: string | null
  raw: FioTransaction
}

function mustToken(): string {
  const t = process.env.FIO_TOKEN
  if (!t) throw new Error('FIO_TOKEN missing')
  return t
}

async function mustJson<T>(r: Response): Promise<T> {
  const text = await r.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Fio returned non-JSON: ${text.slice(0, 300)}`)
  }
}

function colVal<T>(c?: FioColumnValue<T>): T | null {
  return c?.value ?? null
}

function toDate(v: number | string | null): Date | null {
  if (v == null) return null

  // most common: epoch ms
  if (typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // sometimes: "YYYY-MM-DD+0100" or similar
  const s = String(v).trim()
  if (!s) return null

  // handle "YYYY-MM-DD+0100" -> "YYYY-MM-DDT00:00:00+01:00"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})([+-]\d{4})$/)
  if (m) {
    const datePart = m[1]
    const tz = m[2]
    const tz2 = `${tz.slice(0, 3)}:${tz.slice(3)}`
    const d = new Date(`${datePart}T00:00:00${tz2}`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Normalize one transaction row to a stable shape.
 * Returns null if essential fields are missing.
 */
export function normalizeFioTx(t: FioTransaction): NormalizedFioTx | null {
  const movementIdNum = colVal<number>(t.column22)
  const movementId = movementIdNum != null ? String(movementIdNum) : null

  const amountNum = colVal<number>(t.column1)
  const bookedAt = toDate(colVal<number | string>(t.column0))

  if (!movementId || amountNum == null || !bookedAt) return null

  const currency = (colVal<string>(t.column14) || 'CZK').toUpperCase()
  const vsRaw = colVal<string>(t.column5)
  const variableSymbol = vsRaw ? String(vsRaw).trim() : null

  const msg = colVal<string>(t.column16)
  const cmt = colVal<string>(t.column25)
  const message = (msg || cmt || '').trim() || null

  return {
    movementId,
    bookedAt,
    amountCzk: Math.round(Number(amountNum)), // keep int CZK
    currency,
    variableSymbol,
    message,
    raw: t,
  }
}

/**
 * ⚠️ May require strong auth (SCA). Prefer fioFetchPeriod() for cron automation.
 */
export async function fioFetchLast(): Promise<FioStatementResponse> {
  const token = mustToken()
  const url = `${FIO_BASE}/last/${token}/transactions.json`

  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Fio last failed: ${r.status} ${r.statusText} ${body}`)
  }
  return await mustJson<FioStatementResponse>(r)
}

/**
 * ✅ Cron-friendly (within the last ~90 days usually doesn't need SCA)
 * from/to in YYYY-MM-DD
 */
export async function fioFetchPeriod(params: { from: string; to: string }): Promise<FioStatementResponse> {
  const token = mustToken()
  const url = `${FIO_BASE}/periods/${token}/${params.from}/${params.to}/transactions.json`

  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Fio periods failed: ${r.status} ${r.statusText} ${body}`)
  }
  return await mustJson<FioStatementResponse>(r)
}

export async function fioSetLastId(lastId: string | number): Promise<void> {
  const token = mustToken()
  const url = `${FIO_BASE}/set-last-id/${token}/${lastId}/`

  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Fio set-last-id failed: ${r.status} ${r.statusText} ${body}`)
  }
}