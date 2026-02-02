// backend/src/jobs/adoptionBankCron.ts
import cron from 'node-cron'
import { prisma } from '../prisma'
import { SubscriptionStatus, PaymentProvider } from '@prisma/client'
import { sendEmailSafe } from '../services/email'

/**
 * Advisory lock so multiple app instances on DO don't run it simultaneously.
 */
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

function daysAgo(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() - days)
  return x
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

export function startAdoptionBankCron() {
  const enabled = String(process.env.ADOPTION_BANK_CRON_ENABLED || 'true').toLowerCase() !== 'false'
  if (!enabled) {
    console.log('[ADOPTION-BANK CRON] disabled via ADOPTION_BANK_CRON_ENABLED=false')
    return
  }

  const schedule = process.env.ADOPTION_BANK_CRON_SCHEDULE || '20 3 * * *' // daily 03:20
  const runOnInit = String(process.env.ADOPTION_BANK_CRON_RUN_ON_INIT || 'false').toLowerCase() === 'true'

  const reminderAfterDays = Math.max(1, Number(process.env.ADOPTION_BANK_REMINDER_AFTER_DAYS || 30))
  const cancelAfterDays = Math.max(reminderAfterDays + 1, Number(process.env.ADOPTION_BANK_CANCEL_AFTER_DAYS || 40))

  console.log(
    `[ADOPTION-BANK CRON] scheduled: ${schedule} (runOnInit=${runOnInit}) reminderAfterDays=${reminderAfterDays} cancelAfterDays=${cancelAfterDays}`,
  )

  const job = async () => {
    const now = new Date()

    const res = await withAdvisoryLock(991133, async () => {
      // 1) Ensure pendingSince is set for BANK/FIO pending subscriptions that don't have it
      const seeded = await prisma.subscription.updateMany({
        where: {
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          pendingSince: { equals: null },
        },
        data: {
          pendingSince: now, // OK: assigning Date
          tempAccessUntil: addDays(now, reminderAfterDays),
          graceUntil: addDays(now, cancelAfterDays),
        },
      })

      // 2) Send reminders: pendingSince <= now - reminderAfterDays AND reminderSentAt is null
      const reminderCutoff = daysAgo(now, reminderAfterDays)

      const toRemind = await prisma.subscription.findMany({
        where: {
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          pendingSince: { lte: reminderCutoff },
          reminderSentAt: { equals: null },
        },
        include: {
          user: { select: { email: true, firstName: true } },
          animal: { select: { jmeno: true, name: true, id: true } },
        },
        take: 500,
      })

      let reminded = 0
      for (const sub of toRemind) {
        const email = sub.user?.email
        if (!email) continue

        const animalName = sub.animal?.jmeno || sub.animal?.name || 'zvíře'
        const amount = sub.monthlyAmount
        const vs = sub.variableSymbol || ''
        const iban = (process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || '').trim()

        const subject = 'Připomínka platby – adopce bankovním převodem'
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111;">
            <h2 style="margin:0 0 12px 0;">Připomínka platby</h2>
            <p style="margin:0 0 10px 0;line-height:1.5;">
              Děkujeme za adopci. Zatím jsme u vaší adopce neviděli první platbu.
            </p>
            <div style="background:#F6F8FF;border:1px solid #D9E2FF;border-radius:12px;padding:14px 16px;margin:16px 0;">
              <div><b>Zvíře:</b> ${animalName}</div>
              <div><b>Částka:</b> ${amount} Kč / měsíc</div>
              ${iban ? `<div><b>IBAN:</b> ${iban}</div>` : ''}
              ${vs ? `<div><b>VS:</b> ${vs}</div>` : ''}
            </div>
            <p style="margin:0;line-height:1.5;">
              Pokud platba nepřijde v nejbližších dnech, přístup může být dočasně deaktivován.
            </p>
            <p style="margin:12px 0 0 0;color:#555;">Tým Dogpoint ❤️</p>
          </div>
        `

        await sendEmailSafe({ to: email, subject, html })

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            reminderSentAt: now,
            reminderCount: { increment: 1 },
          },
        })

        reminded++
      }

      // 3) Cancel/deactivate after cancelAfterDays since pendingSince
      const cancelCutoff = daysAgo(now, cancelAfterDays)

      const toCancel = await prisma.subscription.findMany({
        where: {
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          pendingSince: { lte: cancelCutoff },
        },
        select: { id: true },
        take: 1000,
      })

      const canceled = await prisma.subscription.updateMany({
        where: { id: { in: toCancel.map((x) => x.id) } },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: now,

          // IMPORTANT: Prisma wants `{ set: null }` for nullable DateTime fields
          tempAccessUntil: { set: null },
          graceUntil: { set: null },
        },
      })

      return { seeded: seeded.count, toRemind: toRemind.length, reminded, canceled: canceled.count }
    })

    if (!res) {
      console.log('[ADOPTION-BANK CRON] skipped (lock not acquired)')
      return
    }

    console.log(
      `[ADOPTION-BANK CRON] ok seeded=${res.seeded} toRemind=${res.toRemind} reminded=${res.reminded} canceled=${res.canceled}`,
    )
  }

  cron.schedule(schedule, () => {
    job().catch((e: any) => console.error('[ADOPTION-BANK CRON] error', e?.message || e))
  })

  if (runOnInit) {
    job().catch((e: any) => console.error('[ADOPTION-BANK CRON] init error', e?.message || e))
  }
}