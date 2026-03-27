// backend/src/services/email.ts
import nodemailer from 'nodemailer'

function firstNonEmpty(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return undefined
}

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED ?? '1') !== '0'

/** Support EMAIL_* (primary) and common aliases (SMTP_*, MAIL_*) so dev/prod envs match provider docs. */
const host = firstNonEmpty('EMAIL_HOST', 'SMTP_HOST', 'MAIL_HOST')
const port = Number(firstNonEmpty('EMAIL_PORT', 'SMTP_PORT', 'MAIL_PORT') || '587')
const user = firstNonEmpty('EMAIL_USER', 'SMTP_USER', 'MAIL_USER')

const pass = firstNonEmpty(
  'EMAIL_PASS',
  'EMAIL_PASSWORD',
  'SMTP_PASS',
  'SMTP_PASSWORD',
  'MAIL_PASSWORD',
)

const from = firstNonEmpty('EMAIL_FROM', 'SMTP_FROM', 'MAIL_FROM') || user
const secure = port === 465 || String(process.env.EMAIL_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true'

const smtpConfigured = Boolean(host && user && pass)

if (!EMAIL_ENABLED) {
  console.warn('[email] EMAIL_ENABLED=0 -> emails disabled')
} else if (!smtpConfigured) {
  console.warn('[email] SMTP NOT configured', {
    host: Boolean(host),
    user: Boolean(user),
    pass: Boolean(pass),
    port,
    triedHostKeys: 'EMAIL_HOST | SMTP_HOST | MAIL_HOST',
    triedUserKeys: 'EMAIL_USER | SMTP_USER | MAIL_USER',
    triedPassKeys: 'EMAIL_PASS | EMAIL_PASSWORD | SMTP_PASS | SMTP_PASSWORD | MAIL_PASSWORD',
  })
} else {
  console.log('[email] SMTP configured', { host, port, secure, from: from || '(same as user)' })
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

export function isEmailEnabled(): boolean {
  return EMAIL_ENABLED
}

/** Non-secret diagnostics for /health/email (dev + prod). */
export function getEmailDiagnostics(): {
  emailEnabled: boolean
  smtpReady: boolean
  present: { host: boolean; user: boolean; pass: boolean; from: boolean }
  missingPieces: string[]
} {
  const present = {
    host: Boolean(host),
    user: Boolean(user),
    pass: Boolean(pass),
    from: Boolean(from),
  }
  const missingPieces: string[] = []
  if (!present.host) missingPieces.push('host (EMAIL_HOST or SMTP_HOST or MAIL_HOST)')
  if (!present.user) missingPieces.push('user (EMAIL_USER or SMTP_USER or MAIL_USER)')
  if (!present.pass) missingPieces.push('password (EMAIL_PASS or EMAIL_PASSWORD or SMTP_PASS, …)')
  return {
    emailEnabled: EMAIL_ENABLED,
    smtpReady: Boolean(transporter),
    present,
    missingPieces,
  }
}

export const EMAIL_SMTP_MISSING_HINT =
  'Set host, user, and password using EMAIL_HOST / EMAIL_USER / EMAIL_PASS (or SMTP_HOST / SMTP_USER / SMTP_PASS, etc.). Optional: EMAIL_PORT, EMAIL_SECURE, EMAIL_FROM.'

/** Same resolution as the shared transporter — for routes that build their own nodemailer (PDF, cron). */
export function getSmtpAuthForLegacyRoutes():
  | {
      host: string
      user: string
      pass: string
      port: number
      secure: boolean
      from: string
    }
  | null {
  if (!host || !user || !pass) return null
  return {
    host,
    user,
    pass,
    port,
    secure,
    from: from || user,
  }
}

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
      code: e?.code,
      response: e?.response,
    })
    // intentionally swallow errors
  }
}
