// backend/src/jobs/adoptionBankCron.ts
import { prisma } from '../prisma'

/**
 * BANK TRANSFER (FIO) cron:
 * - PENDING subscriptions get temporary access for 30 days (tempAccessUntil)
 * - If not paid within 30 days -> send reminder + set graceUntil (+10 days)
 * - If still not paid after graceUntil -> set INACTIVE (or CANCELED if you prefer)
 *
 * NOTE:
 * - This job must NOT crash the app if some schema fields differ.
 * - It runs only in production by default (can be overridden).
 */

let intervalHandle: NodeJS.Timeout | null = null

const MS = {
  minute: 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
}

function boolEnv(name: string, def = false): boolean {
  const v = (process.env[name] || '').trim().toLowerCase()
  if (!v) return def
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + days)
  return x
}

async function tick() {
  // If your system has another “payment confirmed” mechanism,
  // this cron just enforces reminders + expiry for *still pending* ones.

  const now = new Date()

  // We try to be tolerant: if some fields don’t exist in your Prisma schema
  // in a given environment, Prisma will throw — we catch and log.
  try {
    // 1) find PENDING bank subscriptions
    // provider: FIO (bank transfer)
    const pending = await prisma.subscription.findMany({
      where: {
        status: 'PENDING' as any,
        provider: 'FIO' as any,
      } as any,
      select: {
        id: true,
        userId: true,
        animalId: true,
        status: true,
        provider: true,
        pendingSince: true as any,
        tempAccessUntil: true as any,
        graceUntil: true as any,
        reminderSentAt: true as any,
        reminderCount: true as any,
        monthlyAmount: true,
      } as any,
      take: 500,
    })

    let changed = 0

    for (const s of pending as any[]) {
      const pendingSince: Date | null = s.pendingSince ? new Date(s.pendingSince) : null
      const tempAccessUntil: Date | null = s.tempAccessUntil ? new Date(s.tempAccessUntil) : null
      const graceUntil: Date | null = s.graceUntil ? new Date(s.graceUntil) : null
      const reminderSentAt: Date | null = s.reminderSentAt ? new Date(s.reminderSentAt) : null
      const reminderCount: number = Number.isFinite(s.reminderCount) ? Number(s.reminderCount) : 0

      // If timeline fields are missing, initialize them safely
      const initPendingSince = pendingSince ?? now
      const initTempAccessUntil = tempAccessUntil ?? addDays(initPendingSince, 30)

      // If we had to initialize fields, write them once
      if (!pendingSince || !tempAccessUntil) {
        await prisma.subscription.update({
          where: { id: s.id },
          data: {
            pendingSince: initPendingSince,
            tempAccessUntil: initTempAccessUntil,
            reminderCount,
          } as any,
        })
        changed++
        continue
      }

      // 2) If past tempAccessUntil and no graceUntil -> send reminder + set grace (+10d)
      if (now > initTempAccessUntil && !graceUntil) {
        // send reminder email (optional)
        try {
          await sendReminderEmailSafe({
            userId: s.userId,
            animalId: s.animalId,
            amountCZK: s.monthlyAmount ?? undefined,
          })
        } catch (e: any) {
          console.warn('[bank-cron] reminder email failed:', e?.message || e)
        }

        await prisma.subscription.update({
          where: { id: s.id },
          data: {
            graceUntil: addDays(now, 10),
            reminderSentAt: now,
            reminderCount: reminderCount + 1,
          } as any,
        })
        changed++
        continue
      }

      // 3) If graceUntil passed -> expire the pending subscription
      if (graceUntil && now > graceUntil) {
        await prisma.subscription.update({
          where: { id: s.id },
          data: {
            status: 'INACTIVE' as any, // or 'CANCELED' if that’s your preferred final state
          } as any,
        })
        changed++
        continue
      }

      // 4) Optional: don’t spam reminders too often (e.g., max 1 per day)
      if (graceUntil && reminderSentAt) {
        // nothing
      }
    }

    if (changed > 0) {
      console.log(`[bank-cron] updated ${changed} subscription(s)`)
    }
  } catch (e: any) {
    console.error('[bank-cron] tick failed:', e?.message || e)
  }
}

/**
 * Safe reminder sender.
 * If you already have a reminder system elsewhere, you can leave this as a no-op.
 */
async function sendReminderEmailSafe(args: { userId: string; animalId: string; amountCZK?: number }) {
  // If you already have your notification/email service, plug it in here.
  // Keeping it non-fatal and optional.
  if (!boolEnv('BANK_CRON_SEND_EMAILS', false)) return

  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { email: true, firstName: true },
  })
  if (!user?.email) return

  const nodemailerMod: any = await import('nodemailer')
  const nodemailer = nodemailerMod.default || nodemailerMod

  const host = process.env.EMAIL_HOST
  const userEnv = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  const from = process.env.EMAIL_FROM || 'Dogpoint <info@dogpoint.cz>'
  const port = Number(process.env.EMAIL_PORT || 587)
  const secure = port === 465

  if (!host || !userEnv || !pass) return

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: userEnv, pass },
  })

  const subject = 'Dogpoint – připomínka platby za adopci'
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111;">
      <h2 style="margin:0 0 12px 0;">Připomínka platby</h2>
      <p style="margin:0 0 10px 0;line-height:1.5;">
        Dobrý den${user.firstName ? `, ${user.firstName}` : ''},
        evidujeme adopci, u které zatím nedošla první platba.
      </p>
      <p style="margin:0 0 10px 0;line-height:1.5;">
        Pokud jste již platbu odeslali, ignorujte prosím tento e-mail – spárování proběhne automaticky (Fio import).
      </p>
      <p style="margin:0;color:#555;">Tým Dogpoint ❤️</p>
    </div>
  `

  await transporter.sendMail({ from, to: user.email, subject, html })
}

/**
 * Start the cron loop.
 * - Default: production only
 * - Override with BANK_CRON_ENABLED=true in env
 */
export function startAdoptionBankCron() {
  const enabled =
    boolEnv('BANK_CRON_ENABLED', false) ||
    (process.env.NODE_ENV === 'production' && !boolEnv('BANK_CRON_DISABLED', false))

  if (!enabled) {
    console.log('[bank-cron] disabled')
    return
  }

  if (intervalHandle) return

  const everyMinutes = Number(process.env.BANK_CRON_EVERY_MINUTES || 5)
  const intervalMs = Math.max(1, everyMinutes) * MS.minute

  console.log(`[bank-cron] starting (every ${everyMinutes} min)`)

  // run once quickly, then interval
  tick().catch(() => {})
  intervalHandle = setInterval(() => {
    tick().catch(() => {})
  }, intervalMs)
}

export function stopAdoptionBankCron() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}