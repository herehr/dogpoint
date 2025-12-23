// backend/src/services/email.ts
import nodemailer from 'nodemailer'

const host = process.env.EMAIL_HOST
const port = Number(process.env.EMAIL_PORT || 587)
const user = process.env.EMAIL_USER
const pass = process.env.EMAIL_PASS
const from = process.env.EMAIL_FROM || user

const smtpConfigured = !!(host && user && pass)

if (!smtpConfigured) {
  console.warn('[email] SMTP NOT configured:', {
    host: !!host,
    user: !!user,
    pass: !!pass,
    port,
  })
} else {
  console.log('[email] SMTP configured:', { host, port, secure: port === 465, from })
}

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user, pass },
    })
  : null

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
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
    console.log('[email] sent:', { to, subject, messageId: info.messageId })
  } catch (err: any) {
    console.error('[email] send failed:', err?.message || err, { to, subject })
    throw err
  }
}