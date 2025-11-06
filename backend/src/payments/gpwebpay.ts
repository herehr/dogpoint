// backend/src/payments/gpwebpay.ts
import crypto from 'crypto'

type BuildParams = {
  merchantNumber: string
  orderNumber: string
  amountCents: number
  currency: string // 'CZK' etc.
  depositFlag: 0 | 1
  url: string // return URL
  description?: string
  md?: string // merchant data (free text)
}

/**
 * Build GP webpay redirect URL by signing params with the private key.
 * NOTE: This is a minimal helper sufficient to compile and run.
 * You will likely refine ordering/encoding according to final GP docs.
 */
export function buildRedirectUrl(
  gatewayBase: string,
  p: BuildParams,
  privateKeyPem: string,
  privateKeyPass?: string
): string {
  const params: Record<string, string> = {
    MERCHANTNUMBER: p.merchantNumber,
    ORDERNUMBER: p.orderNumber,
    AMOUNT: String(p.amountCents),
    CURRENCY: p.currency,
    DEPOSITFLAG: String(p.depositFlag),
    URL: p.url,
  }
  if (p.description) params.DESCRIPTION = p.description
  if (p.md) params.MD = p.md

  const dataToSign = makeDataToSign(params)
  const digest = signData(dataToSign, privateKeyPem, privateKeyPass)
  const q = new URLSearchParams({ ...params, DIGEST: digest })
  return `${gatewayBase}?${q.toString()}`
}

export function verifySignature(
  params: Record<string, string | number>,
  digestB64: string,
  publicKeyPem: string
): boolean {
  const dataToVerify = makeDataToSign(params)
  const verify = crypto.createVerify('RSA-SHA1')
  verify.update(dataToVerify, 'utf8')
  verify.end()
  try {
    return verify.verify(publicKeyPem, Buffer.from(digestB64, 'base64'))
  } catch {
    return false
  }
}

function signData(data: string, privateKeyPem: string, passphrase?: string): string {
  const sign = crypto.createSign('RSA-SHA1')
  sign.update(data, 'utf8')
  sign.end()
  const sig = sign.sign(passphrase ? { key: privateKeyPem, passphrase } : privateKeyPem)
  return sig.toString('base64')
}

/**
 * GP webpay expects a canonical string from parameters.
 * Here we sort keys lexicographically and join as `KEY=value|KEY=value...`
 * Adjust if your spec requires a different order.
 */
function makeDataToSign(obj: Record<string, string | number>): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && `${v}` !== '')
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return entries.map(([k, v]) => `${k}=${v}`).join('|')
}