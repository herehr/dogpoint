// backend/src/services/email.ts
import nodemailer from 'nodemailer'
import type { Attachment } from 'nodemailer/lib/mailer'

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED ?? '1') !== '0'

const host = process.env.EMAIL_HOST
const port = Number(process.env.EMAIL_PORT || 587)
const user = process.env.EMAIL_USER

// accept either EMAIL_PASS or EMAIL_PASSWORD
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

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Attachment[]
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  if (!transporter) {
    console.warn('[email] sendEmail skipped', { to: args.to, subject: args.subject })
    return
  }

  const info = await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    attachments: args.attachments,
  })

  console.log('[email] sent', { to: args.to, subject: args.subject, messageId: info.messageId })
}

export async function sendEmailSafe(args: SendEmailArgs): Promise<void> {
  try {
    await sendEmail(args)
  } catch (e: any) {
    console.error('[email] send failed', {
      to: args.to,
      subject: args.subject,
      error: e?.message || e,
    })
    // never throw from “notification email”
  }
}