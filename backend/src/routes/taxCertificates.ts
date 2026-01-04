// backend/src/routes/taxCertificates.ts
import { Router, type Response } from 'express'
import { requireAuth } from '../middleware/authJwt'
import { Role } from '@prisma/client'
import { loadTaxRecipients } from '../services/taxQuery'
import { renderTaxCertificateHtml } from '../templates/taxCertificateHtml'
import { htmlToPdfBuffer } from '../services/pdf'
import { sendEmailSafe } from '../services/email'

const router = Router()

function isAdmin(req: any): boolean {
  const role = String(req.user?.role || '')
  return role === Role.ADMIN || role === 'ADMIN'
}

/**
 * ADMIN
 * POST /api/tax-certificates/run
 *
 * body:
 * {
 *   year?: number            // default 2025
 *   dryRun?: boolean         // default true
 *   includePledges?: boolean // default true
 *   emails?: string[]        // optional filter
 *   userIds?: string[]       // optional filter
 *   limit?: number           // optional limit
 * }
 */
router.post('/run', requireAuth, async (req: any, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const {
      year = 2025,
      dryRun = true,
      includePledges = true,
      emails,
      userIds,
      limit,
    } = req.body || {}

    const yearNum = Number(year)

    // 1) Load base recipients (REAL function signature)
    let recipients = await loadTaxRecipients(yearNum, Boolean(includePledges))

    // 2) Optional filters
    if (Array.isArray(emails) && emails.length) {
      const emailSet = new Set(
        emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean),
      )
      recipients = recipients.filter((r) =>
        emailSet.has(r.email.trim().toLowerCase()),
      )
    }

    if (Array.isArray(userIds) && userIds.length) {
      const idSet = new Set(userIds.map((id) => String(id)))
      recipients = recipients.filter((r) => idSet.has(r.userId))
    }

    if (typeof limit === 'number' && limit > 0) {
      recipients = recipients.slice(0, limit)
    }

    // 3) Summary
    const summary = {
      year: yearNum,
      dryRun: Boolean(dryRun),
      includePledges: Boolean(includePledges),
      recipients: recipients.length,
      totalCzk: recipients.reduce((s, r) => s + (r.totalCzk || 0), 0),
    }

    // 4) DRY RUN → no emails, no PDFs
    if (dryRun) {
      return res.json({
        ok: true,
        summary,
        sample: recipients.slice(0, 25).map((r) => ({
          email: r.email,
          totalCzk: r.totalCzk,
          items: r.items.length,
        })),
      })
    }

    // 5) SEND MODE
    const results: Array<{ email: string; ok: boolean; error?: string }> = []

    for (const r of recipients) {
      try {
        const html = renderTaxCertificateHtml({
          year: yearNum,
          recipient: r,
          issueDate: new Date(),
        })

        const pdf = await htmlToPdfBuffer(html)

        await sendEmailSafe({
          to: r.email,
          subject: `Potvrzení o daru za rok ${yearNum} – Dogpoint`,
          text:
            `Dobrý den,\n\n` +
            `v příloze zasíláme potvrzení o daru za rok ${yearNum}.\n\n` +
            `Děkujeme,\nDogpoint`,
          html:
            `<p>Dobrý den,</p>` +
            `<p>v příloze zasíláme <strong>potvrzení o daru za rok ${yearNum}</strong>.</p>` +
            `<p>Děkujeme,<br/>Dogpoint</p>`,
          attachments: [
            {
              filename: `potvrzeni-o-daru-${yearNum}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
        })

        results.push({ email: r.email, ok: true })
      } catch (e: any) {
        results.push({
          email: r.email,
          ok: false,
          error: e?.message || String(e),
        })
      }
    }

    const sent = results.filter((x) => x.ok).length
    const failed = results.filter((x) => !x.ok).length

    return res.json({
      ok: true,
      summary,
      sent,
      failed,
      results,
    })
  } catch (e) {
    console.error('[tax-certificates] run error', e)
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router