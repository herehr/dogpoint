// backend/src/routes/taxCertificates.ts
import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../middleware/authJwt'
import { Role } from '@prisma/client'
import { loadTaxRecipients } from '../services/taxQuery'

// You said HTML is stored in backend/src/templates/...
// Adjust imports to your real filenames:
import { renderTaxCertificateHtml } from '../templates/taxCertificateHtml' // <- you have this
import { htmlToPdfBuffer } from '../services/pdf' // <- small helper below, or your existing one
import { sendEmailSafe } from '../services/email'

const router = Router()

function isAdmin(req: any) {
  const role = String(req.user?.role || '')
  return role === Role.ADMIN || role === 'ADMIN'
}

/**
 * ADMIN
 * POST /api/tax-certificates/run
 * body: {
 *   year?: number (default 2025)
 *   dryRun?: boolean
 *   includePledges?: boolean
 *   emails?: string[]
 *   userIds?: string[]
 *   limit?: number
 * }
 */
router.post('/run', requireAuth, async (req: any, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' })

    const {
      year = 2025,
      dryRun = true,
      includePledges = true,
      emails,
      userIds,
      limit,
    } = (req.body || {}) as any

    const recipients = await loadTaxRecipients({
      year: Number(year),
      includePledges: Boolean(includePledges),
      emails: Array.isArray(emails) ? emails : undefined,
      userIds: Array.isArray(userIds) ? userIds : undefined,
      limit: typeof limit === 'number' ? limit : undefined,
    })

    // quick summary
    const summary = {
      year: Number(year),
      dryRun: Boolean(dryRun),
      includePledges: Boolean(includePledges),
      recipients: recipients.length,
      totalCzk: recipients.reduce((s, r) => s + (r.totalCzk || 0), 0),
    }

    if (dryRun) {
      // return sample recipients (safe subset)
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

    // SEND mode
    const results: Array<{ email: string; ok: boolean; error?: string }> = []

    for (const r of recipients) {
      try {
        // Build HTML for this recipient
        const html = renderTaxCertificateHtml({
          year: Number(year),
          recipient: r,
          issuedAt: new Date(),
        })

        // Convert to PDF
        const pdf = await htmlToPdfBuffer(html)

        // Send email with PDF attached
        await sendEmailSafe({
          to: r.email,
          subject: `Potvrzení o daru za rok ${year} – Dogpoint`,
          text: `Dobrý den,\n\nv příloze zasíláme potvrzení o daru za rok ${year}.\n\nDěkujeme,\nDogpoint`,
          html: `<p>Dobrý den,</p><p>v příloze zasíláme <strong>potvrzení o daru za rok ${year}</strong>.</p><p>Děkujeme,<br/>Dogpoint</p>`,
          attachments: [
            {
              filename: `potvrzeni-o-daru-${year}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
        })

        results.push({ email: r.email, ok: true })
      } catch (e: any) {
        results.push({ email: r.email, ok: false, error: e?.message || String(e) })
      }
    }

    const sent = results.filter((x) => x.ok).length
    const failed = results.filter((x) => !x.ok).length

    return res.json({ ok: true, summary, sent, failed, results })
  } catch (e) {
    console.error('[tax-certificates] run error', e)
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router