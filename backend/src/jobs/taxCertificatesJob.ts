export async function runTaxCertificatesJob(opts?: {
  year?: number
  dryRun?: boolean
  emails?: string[]
  userIds?: string[]
  limit?: number
}) {
  const year = opts?.year ?? Number(process.env.TAX_YEAR || new Date().getFullYear() - 1)
  const dryRun = Boolean(opts?.dryRun)

  const emails = opts?.emails?.map(e => e.trim().toLowerCase()).filter(Boolean)
  const userIds = opts?.userIds?.map(s => s.trim()).filter(Boolean)
  const limit = opts?.limit

  // IMPORTANT: adapt your query to accept filters
  const recipients = await getTaxCertificateRecipients(prisma, year, { emails, userIds, limit })

  // ... send loop as before
}