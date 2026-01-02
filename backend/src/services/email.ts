// backend/src/services/email.ts
import nodemailer from 'nodemailer'

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED ?? '1') !== '0'

const host = process.env.EMAIL_HOST
const port = Number(process.env.EMAIL_PORT || 587)
const user = process.env.EMAIL_USER

// ✅ accept either EMAIL_PASS or EMAIL_PASSWORD
const pass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD

const from = process.env.EMAIL_FROM || user
const secure = port === 465 || process.env.EMAIL_SECURE === 'true'

const smtpConfigured = Boolean(host && user && pass)

if (!EMAIL_ENABLED) {
  console.warn('[email] EMAIL_ENABLED=0 -> emails disabled')
} else if (!smtpConfigured) {
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
    secure,
    from,
  })
}

const transporter =
  EMAIL_ENABLED && smtpConfigured
    ? nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      })
    : null

export type SendEmailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: SendEmailAttachment[]
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: SendEmailAttachment[],
): Promise<void> {
  if (!transporter) {
    console.warn('[email] sendEmail skipped', { to, subject })
    return
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  })

  console.log('[email] sent', { to, subject, messageId: info.messageId })
}

export async function sendEmailSafe(args: SendEmailArgs): Promise<void> {
  try {
    await sendEmail(args.to, args.subject, args.html, args.text, args.attachments)
  } catch (e: any) {
    console.error('[email] send failed', {
      to: args.to,
      subject: args.subject,
      error: e?.message || e,
    })
    // ✅ never throw from “notification email”
  }
}