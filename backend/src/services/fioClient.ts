// backend/src/services/fioClient.ts

const FIO_BASE = 'https://fioapi.fio.cz/v1/rest'

type FioColumnValue<T> = { value: T; name?: string; id?: number } | null

export type FioTransaction = {
  column0?: FioColumnValue<number> // date (ms since epoch)
  column1?: FioColumnValue<number> // amount
  column5?: FioColumnValue<string> // VS
  column14?: FioColumnValue<string> // currency
  column22?: FioColumnValue<number> // movementId
  column16?: FioColumnValue<string> // message
  column25?: FioColumnValue<string> // comment
}

export type FioStatement = {
  accountStatement: {
    info: {
      accountId: string
      currency: string
      iban?: string
      bic?: string
      openingBalance?: number
      closingBalance?: number
      dateStart?: any
      dateEnd?: any
      idFrom?: number
      idTo?: number
      idLastDownload?: number
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
  if (ms == null) return null
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d
}

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
    amountCzk: Math.round(Number(amountNum)),
    currency,
    variableSymbol,
    message,
    raw: t,
  }
}

// Optional legacy: /last (often requires strong auth now)
export async function fioFetchLast(): Promise<FioStatement> {
  const token = mustToken()
  const url = `${FIO_BASE}/last/${token}/transactions.json`

  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Fio last failed: ${r.status} ${r.statusText} ${body}`)
  }
  return await mustJson<FioStatement>(r)
}

// ✅ Recommended: /periods (works without 10-min strong auth for <=90d)
export async function fioFetchPeriod(dateFromISO: string, dateToISO: string): Promise<FioStatement> {
  const token = mustToken()
  const url = `${FIO_BASE}/periods/${token}/${dateFromISO}/${dateToISO}/transactions.json`

  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Fio periods failed: ${r.status} ${r.statusText} ${body}`)
  }
  return await mustJson<FioStatement>(r)
}