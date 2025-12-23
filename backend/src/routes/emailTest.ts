// backend/src/routes/emailTest.ts
import { Router, Request, Response } from 'express'
import { sendEmail } from '../services/email'

const router = Router()

/**
 * GET /api/email/test?to=you@example.com
 * Simple SMTP test endpoint
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const to = String(req.query.to || '').trim()

    if (!to || !to.includes('@')) {
      res.status(400).json({ error: 'Missing or invalid ?to=email@example.com' })
      return
    }

    await sendEmail(
      to,
      'Dogpoint SMTP test',
      '<b>SMTP works ✅</b><br/>This is a test email from Dogpoint backend.'
    )

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[emailTest] failed:', err)
    res.status(500).json({ ok: false, error: err?.message || 'send failed' })
  }
})

export default router