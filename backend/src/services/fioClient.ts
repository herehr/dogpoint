// backend/src/services/fioClient.ts

const FIO_BASE = 'https://fioapi.fio.cz/v1/rest'

type FioColumnValue<T> = { value: T; name?: string; id?: number } | null

export type FioTransaction = {
  column0?: FioColumnValue<number> // date (ms since epoch) OR sometimes yyyy-mm-dd? but API usually ms
  column1?: FioColumnValue<number> // amount
  column5?: FioColumnValue<string> // variable symbol (VS)
  column14?: FioColumnValue<string> // currency
  column22?: FioColumnValue<number> // movementId (unique within account)
  column16?: FioColumnValue<string> // message
  column25?: FioColumnValue<string> // comment
}

export type FioLastResponse = {
  accountStatement: {
    info: {
      accountId: string
      currency: string
      idLastDownload?: number
      dateStart?: number
      dateEnd?: number
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

function toDateFromMs(ms: number | null): Date | null {
  if (!ms) return null
  // fio returns ms since epoch in column0 (often)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * Normalize one transaction row to a stable shape.
 * Returns null if essential fields are missing.
 */
export function normalizeFioTx(t: FioTransaction): NormalizedFioTx | null {
  const movementIdNum = colVal<number>(t.column22)
  const movementId = movementIdNum != null ? String(movementIdNum) : null

  const amountNum = colVal<number>(t.column1)
  const bookedAt = toDateFromMs(colVal<number>(t.column0))

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
    amountCzk: Math.round(Number(amountNum)), // fio amounts are usually exact; keep int CZK
    currency,
    variableSymbol,
    message,
    raw: t,
  }
}

export async function fioFetchLast(): Promise<FioLastResponse> {
  const token = mustToken()
  const url = `${FIO_BASE}/last/${token}/transactions.json`

  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Fio last failed: ${r.status} ${r.statusText} ${body}`)
  }
  return await mustJson<FioLastResponse>(r)
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