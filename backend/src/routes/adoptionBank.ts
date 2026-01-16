// backend/src/routes/adoptionBank.ts
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { PaymentMethod, PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client'

const router = Router()

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} missing`)
  return v
}

function nowPlusDays(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function generateUniqueVS(prefix = '595'): Promise<string> {
  // 595 + 7 digits = 10 digits total
  for (let i = 0; i < 50; i++) {
    const rnd = Math.floor(Math.random() * 10_000_000)
    const vs = `${prefix}${String(rnd).padStart(7, '0')}`

    // Must be unique across Subscription.variableSymbol (unique)
    const exists = await prisma.subscription.findFirst({
      where: { variableSymbol: vs },
      select: { id: true },
    })
    if (!exists) return vs
  }
  throw new Error('Could not generate unique VS (too many collisions)')
}

// SPAYD: SPD*1.0*ACC:<IBAN>*AM:<amount>*CC:CZK*X-VS:<vs>*MSG:<msg>
function buildSpayd(params: { iban: string; amountCZK: number; vs: string; msg?: string }) {
  const iban = params.iban.replace(/\s+/g, '').toUpperCase()
  const msg = (params.msg || '').trim().replace(/\*/g, ' ').slice(0, 60)
  const amount = params.amountCZK.toFixed(2)

  const parts = ['SPD*1.0', `ACC:${iban}`, `AM:${amount}`, 'CC:CZK', `X-VS:${params.vs}`]
  if (msg) parts.push(`MSG:${msg}`)
  return parts.join('*')
}

/**
 * Creates:
 * - User (if needed)
 * - Subscription (provider=FIO, status=PENDING, variableSymbol=595xxxxxxx)
 * - Pledge (method=BANK, status=PENDING) linked to user+subscription
 *
 * Returns bank instructions + VS + SPAYD.
 */
router.post('/bank/start', async (req, res) => {
  try {
    const { animalId, amountCZK, email, name, password } = req.body as {
      animalId: string
      amountCZK: number
      email: string
      name: string
      password: string
    }

    if (!animalId) return res.status(400).json({ error: 'animalId missing' })
    if (!email) return res.status(400).json({ error: 'email missing' })
    if (!name) return res.status(400).json({ error: 'name missing' })
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 chars' })
    }

    const amount = Math.round(Number(amountCZK || 0))
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amountCZK invalid' })
    }

    // Make sure animal exists
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, name: true, jmeno: true },
    })
    if (!animal) return res.status(404).json({ error: 'animal not found' })

    const recipientName = mustEnv('BANK_RECIPIENT_NAME')
    const iban = mustEnv('BANK_IBAN')
    const bic = process.env.BANK_BIC || null
    const msgPrefix = process.env.BANK_MESSAGE_PREFIX || 'Dogpoint adopce'
    const vsPrefix = process.env.BANK_VS_PREFIX || '595'
    const tempDays = Number(process.env.BANK_TEMP_ACCESS_DAYS || 30)

    const message = `${msgPrefix} ${animalId}`.slice(0, 60)

    const result = await prisma.$transaction(async (tx) => {
      // 1) user
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true },
      })

      let userId: string

      if (!existing) {
        const passwordHash = await bcrypt.hash(password, 10)
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: name,
          },
          select: { id: true },
        })
        userId = created.id
      } else {
        userId = existing.id

        // If user exists but has no passwordHash (legacy / magic-link), set it
        if (!existing.passwordHash) {
          const passwordHash = await bcrypt.hash(password, 10)
          await tx.user.update({
            where: { id: userId },
            data: { passwordHash },
          })
        }
      }

      // 2) subscription
      const variableSymbol = await generateUniqueVS(vsPrefix)

      const sub = await tx.subscription.create({
        data: {
          userId,
          animalId,
          monthlyAmount: amount,
          currency: 'CZK',
          provider: PaymentProvider.FIO,
          status: SubscriptionStatus.PENDING,
          variableSymbol,
          message,

          pendingSince: new Date(),
          tempAccessUntil: nowPlusDays(tempDays),
          graceUntil: null,
          reminderSentAt: null,
          reminderCount: 0,
        },
        // IMPORTANT: variableSymbol can be nullable in Prisma schema => TS may treat it as string | null
        select: { id: true, variableSymbol: true },
      })

      // ✅ hard guarantee string for downstream code (SPAYD + response)
      const vs = sub.variableSymbol ?? variableSymbol
      if (!vs) throw new Error('Subscription.variableSymbol is null (unexpected)')

      // 3) pledge
      const pledge = await tx.pledge.create({
        data: {
          animalId,
          email,
          name,
          amount,
          interval: 'MONTHLY',
          method: PaymentMethod.BANK,
          status: PaymentStatus.PENDING,
          providerId: null,
          note: 'BANK start (FIO)',
          userId,
          subscriptionId: sub.id,
          variableSymbol: vs,
        },
        select: { id: true },
      })

      const spayd = buildSpayd({ iban, amountCZK: amount, vs, msg: message })

      return {
        subscriptionId: sub.id,
        pledgeId: pledge.id,
        variableSymbol: vs,
        recipientName,
        iban,
        bic,
        amountCZK: amount,
        message,
        spayd,
      }
    })

    return res.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[adoption bank start] error', e?.message || e)
    return res.status(500).json({ error: 'internal error' })
  }
})

export default router