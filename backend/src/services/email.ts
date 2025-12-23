// backend/src/services/email.ts
import nodemailer from 'nodemailer'

const host = process.env.EMAIL_HOST
const port = Number(process.env.EMAIL_PORT || 587)
const user = process.env.EMAIL_USER
const pass = process.env.EMAIL_PASS
const from = process.env.EMAIL_FROM || user

const smtpConfigured = Boolean(host && user && pass)

if (!smtpConfigured) {
  console.warn('[email] SMTP NOT configured', {
    host: Boolean(host),
    user: Boolean(user),
    pass: Boolean(pass),
    port,
  })
} else {
  console.log('[email] SMTP configured', {
    host,
    port,
    secure: port === 465,
    from,
  })
}

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: {
        user,
        pass,
      },
    })
  : null

/**
 * Send email via SMTP.
 * Safe: does nothing if SMTP is not configured.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  if (!transporter) {
    console.warn('[email] sendEmail skipped (SMTP not configured)', { to, subject })
    return
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    })

    console.log('[email] sent', {
      to,
      subject,
      messageId: info.messageId,
    })
  } catch (err: any) {
    console.error('[email] send failed', {
      to,
      subject,
      error: err?.message || err,
    })
    throw err
  }
}