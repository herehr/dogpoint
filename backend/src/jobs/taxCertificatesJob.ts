// backend/src/jobs/taxCertificatesJob.ts
import { prisma } from '../prisma'
import { loadTaxRecipients } from '../services/taxQuery'

type Options = {
  emails?: string[]
  userIds?: string[]
  limit?: number
}

export async function getTaxCertificateRecipients(year: number, opts: Options = {}) {
  const all = await loadTaxRecipients(year, true)

  const emails = (opts.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  const userIds = (opts.userIds ?? []).map((x) => x.trim()).filter(Boolean)

  let out = all

  if (emails.length) out = out.filter((r) => emails.includes(r.email.toLowerCase()))
  if (userIds.length) out = out.filter((r) => userIds.includes(r.userId))
  if (opts.limit && opts.limit > 0) out = out.slice(0, opts.limit)

  return out
}