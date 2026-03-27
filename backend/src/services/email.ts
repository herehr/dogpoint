// backend/src/services/email.ts
import nodemailer from 'nodemailer'

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
  console.log('[email] SMTP configured', { host, port, secure, from })
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

/** True when nodemailer will actually send (same rules as production). Use for health checks / tests. */
export function isSmtpConfigured(): boolean {
  return Boolean(transporter)
}

export const EMAIL_SMTP_MISSING_HINT =
  'Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS or EMAIL_PASSWORD (optional: EMAIL_PORT, EMAIL_SECURE, EMAIL_FROM). Same values work for dev and production builds.'

export type EmailAttachment = {
  filename: string
  content: Buffer | string
  contentType?: string
  cid?: string
}

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
}

/**
 * sendEmail supports BOTH styles:
 *  - sendEmail({ to, subject, html, text?, attachments? })
 *  - sendEmail(to, subject, html, text?)
 */
export function sendEmail(args: SendEmailArgs): Promise<void>
export function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<void>
export async function sendEmail(
  a: SendEmailArgs | string,
  subject?: string,
  html?: string,
  text?: string,
): Promise<void> {
  const payload: SendEmailArgs =
    typeof a === 'string'
      ? { to: a, subject: subject || '', html: html || '', text }
      : a

  if (!transporter) {
    console.error('[email] sendEmail skipped (SMTP not configured)', {
      to: payload.to,
      subject: payload.subject,
      hint: EMAIL_SMTP_MISSING_HINT,
    })
    return
  }

  const info = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    attachments: payload.attachments,
  })

  console.log('[email] sent', {
    to: payload.to,
    subject: payload.subject,
    messageId: info.messageId,
  })
}

/**
 * sendEmailSafe supports BOTH styles and NEVER throws
 */
export function sendEmailSafe(args: SendEmailArgs): Promise<void>
export function sendEmailSafe(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<void>
export async function sendEmailSafe(
  a: SendEmailArgs | string,
  subject?: string,
  html?: string,
  text?: string,
): Promise<void> {
  try {
    if (typeof a === 'string') {
      await sendEmail(a, subject || '', html || '', text)
    } else {
      await sendEmail(a)
    }
  } catch (e: any) {
    const to = typeof a === 'string' ? a : a.to
    const subj = typeof a === 'string' ? subject : a.subject
    console.error('[email] send failed', {
      to,
      subject: subj,
      error: e?.message || e,
    })
    // intentionally swallow errors
  }
}