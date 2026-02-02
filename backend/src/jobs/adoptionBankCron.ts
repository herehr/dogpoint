// backend/src/jobs/adoptionBankCron.ts
import cron from 'node-cron'
import { prisma } from '../prisma'
import { sendEmailSafe } from '../services/email'
import { PaymentProvider, SubscriptionStatus, PaymentStatus } from '@prisma/client'

// Simple advisory lock so multiple app instances don't run simultaneously
async function withAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
  const got = await prisma.$queryRawUnsafe<{ locked: boolean }[]>(
    `SELECT pg_try_advisory_lock(${key}) as locked`,
  )
  if (!got?.[0]?.locked) return null
  try {
    return await fn()
  } finally {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${key})`)
  }
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function startAdoptionBankCron() {
  const enabled = String(process.env.ADOPTION_BANK_CRON_ENABLED || 'true').toLowerCase() !== 'false'
  if (!enabled) {
    console.log('[ADOPTION-BANK CRON] disabled via ADOPTION_BANK_CRON_ENABLED=false')
    return
  }

  // Default: every day at 03:20
  const schedule = process.env.ADOPTION_BANK_CRON_SCHEDULE || '20 3 * * *'
  const runOnInit =
    String(process.env.ADOPTION_BANK_CRON_RUN_ON_INIT || 'false').toLowerCase() === 'true'

  const reminderAfterDays = Math.max(1, Number(process.env.ADOPTION_BANK_REMINDER_AFTER_DAYS || 30))
  const cancelAfterDays = Math.max(
    reminderAfterDays + 1,
    Number(process.env.ADOPTION_BANK_CANCEL_AFTER_DAYS || 40),
  )

  console.log(
    `[ADOPTION-BANK CRON] scheduled: ${schedule} (runOnInit=${runOnInit}) reminderAfterDays=${reminderAfterDays} cancelAfterDays=${cancelAfterDays}`,
  )

  const job = async () => {
    const reminderCutoff = daysAgo(reminderAfterDays)
    const cancelCutoff = daysAgo(cancelAfterDays)

    console.log(
      `[ADOPTION-BANK CRON] run start (remind <= ${reminderCutoff.toISOString()}, cancel <= ${cancelCutoff.toISOString()})`,
    )

    const res = await withAdvisoryLock(991133, async () => {
      // 0) Activate if a PAID payment exists (FIO import creates Payment rows)
      const activated = await prisma.subscription.updateMany({
        where: {
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          payments: {
            some: {
              status: PaymentStatus.PAID,
              paidAt: { not: null },
            },
          },
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          pendingSince: null,
          tempAccessUntil: null,
          graceUntil: null,
        },
      })

      // 1) Reminder after N days (only once)
      const remindCandidates = await prisma.subscription.findMany({
        where: {
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          pendingSince: { not: null, lte: reminderCutoff },
          reminderSentAt: null,
          payments: {
            none: {
              status: PaymentStatus.PAID,
              paidAt: { not: null },
            },
          },
        },
        select: {
          id: true,
          user: { select: { email: true, firstName: true, lastName: true } },
          animal: { select: { name: true, jmeno: true } },
          monthlyAmount: true,
          currency: true,
          pendingSince: true,
          variableSymbol: true,
        },
        take: 2000,
      })

      let reminded = 0

      for (const s of remindCandidates) {
        const to = s.user.email
        if (!to) continue

        const animalName = s.animal?.jmeno || s.animal?.name || 'zvíře'
        const fullName = [s.user.firstName, s.user.lastName].filter(Boolean).join(' ').trim()
        const greeting = fullName ? `Dobrý den ${escapeHtml(fullName)},` : 'Dobrý den,'

        const vs = s.variableSymbol ? String(s.variableSymbol) : ''
        const amount = `${Math.round(s.monthlyAmount / 100)} ${escapeHtml(s.currency)}`
        const pendingSinceIso = s.pendingSince ? new Date(s.pendingSince).toISOString().slice(0, 10) : ''

        const subject = `Připomenutí platby – adopce (${animalName})`

        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <p>${greeting}</p>
            <p>
              připomínáme platbu k Vaší adopci (<b>${escapeHtml(animalName)}</b>).
              Evidujeme, že zatím nedorazila první platba.
            </p>
            <ul>
              <li>Částka: <b>${escapeHtml(amount)}</b></li>
              ${vs ? `<li>Variabilní symbol: <b>${escapeHtml(vs)}</b></li>` : ''}
              ${pendingSinceIso ? `<li>Zahájeno: <b>${escapeHtml(pendingSinceIso)}</b></li>` : ''}
            </ul>
            <p>
              Pokud jste již platbu odeslali, děkujeme – v tom případě prosím tento e-mail ignorujte.
            </p>
            <p>
              Děkujeme za podporu,<br/>
              Dogpoint.cz
            </p>
          </div>
        `.trim()

        await sendEmailSafe({
          to,
          subject,
          html,
          text: `${greeting}\n\nPřipomínáme platbu k Vaší adopci (${animalName}). Evidujeme, že zatím nedorazila první platba.\nČástka: ${amount}\n${
            vs ? `VS: ${vs}\n` : ''
          }${pendingSinceIso ? `Zahájeno: ${pendingSinceIso}\n` : ''}\nDěkujeme,\nDogpoint.cz`,
        })

        await prisma.subscription.update({
          where: { id: s.id },
          data: {
            reminderSentAt: new Date(),
            reminderCount: { increment: 1 },
          },
        })

        reminded++
      }

      // 2) Cancel after M days if still unpaid
      const canceled = await prisma.subscription.updateMany({
        where: {
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          pendingSince: { not: null, lte: cancelCutoff },
          payments: {
            none: {
              status: PaymentStatus.PAID,
              paidAt: { not: null },
            },
          },
        },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          graceUntil: null,
          tempAccessUntil: null,
        },
      })

      console.log(
        `[ADOPTION-BANK CRON] activated=${activated.count} reminded=${reminded} canceled=${canceled.count}`,
      )

      return { activated: activated.count, reminded, canceled: canceled.count }
    })

    if (!res) {
      console.log('[ADOPTION-BANK CRON] skipped (lock not acquired)')
      return
    }

    console.log(
      `[ADOPTION-BANK CRON] run ok activated=${res.activated} reminded=${res.reminded} canceled=${res.canceled}`,
    )
  }

  cron.schedule(schedule, () => {
    job().catch((e: any) => {
      console.error('[ADOPTION-BANK CRON] error', e?.message || e)
    })
  })

  if (runOnInit) {
    job().catch((e: any) => console.error('[ADOPTION-BANK CRON] init error', e?.message || e))
  }
}