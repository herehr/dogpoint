// backend/src/routes/adoptionBank.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { SubscriptionStatus, PaymentProvider } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { sendEmailSafe } from '../services/email'
import jwt from 'jsonwebtoken' // ✅ added

const router = Router()

/* ────────────────────────────────────────────── */
/* Optional auth (do NOT break guest flow)         */
/* ────────────────────────────────────────────── */

type AuthPayload = { id: string; role: 'USER' | 'MODERATOR' | 'ADMIN' } // ✅ added

function getBearerToken(req: Request): string | null {
  const h = String(req.headers.authorization || '')
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

function tryGetJwtUserId(req: Request): string | null {
  const token = getBearerToken(req)
  if (!token) return null
  try {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me'
    const payload = jwt.verify(token, secret) as AuthPayload
    return payload?.id || null
  } catch {
    return null
  }
}

/* ────────────────────────────────────────────── */
/* Assets                                         */
/* ────────────────────────────────────────────── */

function firstExistingPath(candidates: string[]): string | null {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p
    } catch {}
  }
  return null
}

function resolveFontPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../assets/fonts/DejaVuSans.ttf'),
    path.resolve(process.cwd(), 'assets/fonts/DejaVuSans.ttf'),
    path.resolve(process.cwd(), 'backend/assets/fonts/DejaVuSans.ttf'),
    '/app/assets/fonts/DejaVuSans.ttf',
    '/app/backend/assets/fonts/DejaVuSans.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/DejaVuSans.ttf',
  ]

  const found = firstExistingPath(candidates)
  if (!found) {
    throw new Error(`PDF font DejaVuSans.ttf not found. Tried:\n- ${candidates.join('\n- ')}`)
  }
  return found
}

function resolveLogoPath(): string | null {
  return firstExistingPath([
    path.resolve(__dirname, '../../assets/logo.png'),
    path.resolve(__dirname, '../../assets/logo.jpg'),
    path.resolve(process.cwd(), 'assets/logo.png'),
    path.resolve(process.cwd(), 'assets/logo.jpg'),
    path.resolve(process.cwd(), 'backend/assets/logo.png'),
    path.resolve(process.cwd(), 'backend/assets/logo.jpg'),
    '/app/assets/logo.png',
    '/app/assets/logo.jpg',
    '/app/backend/assets/logo.png',
    '/app/backend/assets/logo.jpg',
  ])
}

/* ────────────────────────────────────────────── */
/* SPAYD                                          */
/* ────────────────────────────────────────────── */

function buildSpayd(params: { iban: string; amountCZK: number; vs: string; msg?: string }) {
  const iban = String(params.iban || '').replace(/\s+/g, '').toUpperCase()
  const amount = Number(params.amountCZK || 0).toFixed(2)

  const parts = ['SPD*1.0', `ACC:${iban}`, `AM:${amount}`, 'CC:CZK', `X-VS:${params.vs}`]
  const msg = (params.msg || '').trim()
  if (msg) parts.push(`MSG:${msg.replace(/\*/g, ' ').slice(0, 60)}`)
  return parts.join('*')
}

/* ────────────────────────────────────────────── */
/* PDF                                            */
/* ────────────────────────────────────────────── */

async function generateNicePdf(args: {
  animalId: string
  animalName: string
  amountCZK: number
  bankIban: string
  bankName: string
  vs: string
  email: string
  password: string
  loginUrl: string
}) {
  const fontPath = resolveFontPath()
  const logoPath = resolveLogoPath()

  const spayd = buildSpayd({
    iban: args.bankIban,
    amountCZK: args.amountCZK,
    vs: args.vs,
    msg: `Dogpoint adopce ${args.animalId}`,
  })

  const qr = await QRCode.toBuffer(spayd, { scale: 6, margin: 1 })

  const doc = new PDFDocument({ size: 'A4', margin: 48 })
  const chunks: Buffer[] = []
  doc.on('data', (d: Buffer) => chunks.push(d))

  doc.registerFont('Body', fontPath)
  doc.font('Body')

  if (logoPath) doc.image(logoPath, 48, 28, { width: 140 })

// inside generateNicePdf(...) — replace only the shown block with this one

  // Header
  doc.fontSize(20).text('Děkujeme za adopci ❤️', { align: 'right' })
  doc.moveDown(1.5)

  // Section title
  doc.fontSize(13).text('Údaje k bankovnímu převodu')
  doc.moveDown(0.5)

  // ✅ Monthly reminder (standing order)
  doc
    .fontSize(11)
    .text('Naskenujte QR a v bankovní aplikaci nastavte trvalý příkaz 1× měsíčně.')
  doc.moveDown(1)

  // Payment details (clean, readable)
  doc.fontSize(12).text(`Zvíře: ${args.animalName}`)
  doc.moveDown(0.2)
  doc.text(`Částka: ${args.amountCZK} Kč / měsíc`)
  doc.text(`Příjemce: ${args.bankName}`)
  doc.text(`IBAN: ${args.bankIban}`)
  doc.text(`Variabilní symbol (VS): ${args.vs}`)

  // QR
  doc.moveDown(1.2)
  doc.fontSize(11).text('QR platba (SPAYD):')
  doc.moveDown(0.4)
  doc.image(qr, { width: 160 })

  // Login box (simple but nice)
  doc.moveDown(1.2)
  doc.fontSize(13).text('Přihlášení do účtu')
  doc.moveDown(0.4)

  doc.fontSize(11).text(`Přihlášení: ${args.loginUrl}`)
  doc.text(`E-mail: ${args.email}`)
  doc.text(`Heslo: ${args.password}`)

  doc.moveDown(1.2)
  doc
    .fontSize(10)
    .text('Poznámka: Platbu spárujeme automaticky po přijetí první platby (Fio import).')

  doc.end()
  await new Promise<void>((resolve) => doc.on('end', () => resolve()))
  return Buffer.concat(chunks)
}

/* ────────────────────────────────────────────── */
/* EMAIL (USING SHARED MAILER)                    */
/* ────────────────────────────────────────────── */

async function sendPdfEmail(args: {
  to: string
  subject: string
  filename: string
  pdfBuffer: Buffer
  loginUrl: string
  email: string
  password: string
}) {
  // Matches your screenshot wording (simple + clean)
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif; background:#f6f7fb; padding:24px;">
  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">

    <!-- HEADER -->
    <div style="padding:24px; display:flex; align-items:center; justify-content:space-between;">
      <img src="https://patron.dog-point.cz/logo1.png" alt="Dogpoint" style="height:36px;" />
      <a href="https://patron.dog-point.cz"
         style="font-size:14px; color:#2563eb; text-decoration:none;">
        patron.dog-point.cz
      </a>
    </div>

    <div style="padding:0 24px 24px 24px; color:#111;">
      <h1 style="font-size:24px; margin:0 0 12px 0;">
        Děkujeme za adopci ❤️
      </h1>

      <p style="font-size:15px; line-height:1.6; margin:0 0 16px 0;">
        V příloze tohoto e-mailu najdete PDF s QR kódem a údaji k platbě.
      </p>

      <div style="background:#f6f7fb; border-radius:10px; padding:16px; margin:16px 0;">
        <strong>Důležité:</strong><br />
        Naskenujte QR kód a ve své bankovní aplikaci nastavte
        <strong>trvalý příkaz 1× měsíčně</strong>.
      </div>

      <!-- LOGIN BOX -->
      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin:20px 0;">
        <strong>Přihlášení do účtu</strong><br /><br />
        Přihlášení:
        <a href="${args.loginUrl}" target="_blank" rel="noreferrer">
          ${args.loginUrl}
        </a><br />
        E-mail: <strong>${args.email}</strong><br />
        Heslo: <strong>${args.password}</strong>
      </div>

      <p style="margin:24px 0 0 0;">
        Tým Dogpoint ❤️
      </p>
    </div>

    <!-- FOOTER -->
    <div style="background:#f3f4f6; padding:20px; font-size:13px; color:#444;">
      <strong>Kontakty</strong><br />
      Telefon: +420 607 018 218<br />
      E-mail: <a href="mailto:info@dog-point.cz">info@dog-point.cz</a><br /><br />

      <strong>Adresa útulku</strong><br />
      Lhotky 60, 281 63 Malotice<br /><br />

      <strong>Sídlo organizace a korespondenční kontakt</strong><br />
      Dogpoint o.p.s., Milánská 452, 109 00 Praha 15<br /><br />

      <em>
        Tento e-mail byl odeslán automaticky. Prosím neodpovídejte na něj.
      </em>
    </div>

  </div>
</div>
`.trim()

  await sendEmailSafe({
    to: args.to,
    subject: args.subject,
    html,
    attachments: [
      {
        filename: args.filename,
        content: args.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

/* ────────────────────────────────────────────── */
/* AUTH                                           */
/* ────────────────────────────────────────────── */

async function ensureUserAndGetToken(args: { email: string; password: string; name?: string }) {
  const bcryptMod: any = await import('bcryptjs')
  const bcrypt = bcryptMod.default || bcryptMod

  const jwtMod: any = await import('jsonwebtoken')
  const jwt = jwtMod.default || jwtMod

  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) throw new Error('JWT_SECRET missing')

  const email = String(args.email || '').trim().toLowerCase()
  const password = String(args.password || '')

  const existing = await prisma.user.findUnique({ where: { email } })

  let userId: string

  if (!existing) {
    const hash = await bcrypt.hash(password, 10)
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: 'USER' as any,
        firstName: args.name || undefined,
      } as any,
      select: { id: true },
    })
    userId = u.id
  } else {
    userId = existing.id

    const hasHash = Boolean((existing as any).passwordHash)
    if (hasHash) {
      const ok = await bcrypt.compare(password, (existing as any).passwordHash)
      if (!ok) throw Object.assign(new Error('Špatné heslo'), { status: 401 })
    } else {
      const hash = await bcrypt.hash(password, 10)
      await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } as any })
    }

    if (!(existing as any).firstName && args.name) {
      await prisma.user.update({ where: { id: userId }, data: { firstName: args.name } as any })
    }
  }

  const token = jwt.sign({ sub: userId, id: userId, role: 'USER' }, JWT_SECRET, { expiresIn: '30d' })
  return { userId, token }
}

/* ────────────────────────────────────────────── */
/* Internal: get Subscription by new unique        */
/* (avoid TS needing regenerated composite type)   */
/* ────────────────────────────────────────────── */

async function findSubscriptionByUserAnimal(userId: string, animalId: string) {
  // schema has @@unique([userId, animalId])
  // but TS might not have regenerated client -> use findFirst safely
  return prisma.subscription.findFirst({
    where: { userId, animalId },
    select: {
      id: true,
      status: true,
      monthlyAmount: true,
      provider: true,
      variableSymbol: true,
      pendingSince: true,
      tempAccessUntil: true,
      graceUntil: true,
      reminderSentAt: true,
      reminderCount: true,
      startedAt: true,
    },
  })
}

/* ────────────────────────────────────────────── */
/* ROUTES                                         */
/* ────────────────────────────────────────────── */

router.post('/start', async (req: Request, res: Response) => {
  try {
    const animalId = String(req.body?.animalId || '')
    const name = String(req.body?.name || '')
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const vs = String(req.body?.vs || '')
    const sendEmail = req.body?.sendEmail === undefined ? true : Boolean(req.body.sendEmail)

    const amount = Number(req.body?.amountCZK || 0)
    const monthlyAmount = Math.round(amount)
    const provider = PaymentProvider.FIO

    const jwtUserId = tryGetJwtUserId(req) // ✅ added (optional)

    if (!animalId) return res.status(400).json({ error: 'Missing animalId' })

    // ✅ only require email+name+password for guest flow
    if (!jwtUserId) {
      if (!email) return res.status(400).json({ error: 'Missing email' })
      if (!name) return res.status(400).json({ error: 'Missing name' })
      if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' })
    }

    if (!vs) return res.status(400).json({ error: 'Missing vs' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amountCZK' })

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, jmeno: true, name: true },
    })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    // ✅ if logged in -> use JWT userId; else keep existing behavior
    let userId: string
    let token: string

    if (jwtUserId) {
      userId = jwtUserId
      token = getBearerToken(req) || '' // keep existing session token
    } else {
      const r = await ensureUserAndGetToken({ email, password, name })
      userId = r.userId
      token = r.token
    }

    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const loginUrl = process.env.PATRON_LOGIN_URL || 'https://patron.dog-point.cz'

    // ✅ IDEMPOTENCY:
    // If subscription already exists for (userId, animalId) -> DO NOT reset timestamps / status.
    // Just reuse it and optionally send email/PDF again if requested.
    const existing = await findSubscriptionByUserAnimal(userId, animalId)

    let subscriptionId: string
    let reused = false

    if (existing) {
      subscriptionId = existing.id
      reused = true

      // NOTE: no resets here on purpose.
      // We only ensure the VS is stored if it was missing (optional, minimal update).
      if (!existing.variableSymbol && vs) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { variableSymbol: vs } as any,
          select: { id: true },
        })
      }
    } else {
      const now = new Date()
      const tempAccessUntil = new Date(now.getTime() + 40 * 86400000)

      const created = await prisma.subscription.create({
        data: {
          userId,
          animalId,
          status: SubscriptionStatus.PENDING,
          startedAt: now,
          monthlyAmount,
          provider,
          variableSymbol: vs,
          pendingSince: now,
          tempAccessUntil,
          graceUntil: null,
          reminderSentAt: null,
          reminderCount: 0,
        } as any,
        select: { id: true },
      })
      subscriptionId = created.id
    }

    if (sendEmail) {
      // ✅ keep old behavior untouched
      const pdf = await generateNicePdf({
        animalId,
        animalName: animal.jmeno || animal.name || 'Zvíře',
        amountCZK: monthlyAmount,
        bankIban,
        bankName,
        vs,
        email: jwtUserId ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || email : email,
        password,
        loginUrl,
      })

      await sendPdfEmail({
        to: jwtUserId
          ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || email
          : email,
        subject: 'Adopce – údaje k platbě',
        filename: `dogpoint-adopce-${animalId}.pdf`,
        pdfBuffer: pdf,
        loginUrl,
        email: jwtUserId
          ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || email
          : email,
        password,
      })
    }

    return res.json({
      ok: true,
      token,
      userId,
      subscriptionId,
      reused,
      bankIban,
      bankName,
      vs,
      amountCZK: monthlyAmount,
      sendEmail,
    })
  } catch (e: any) {
    console.error('[adoption-bank/start]', e)
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed' })
  }
})

router.post('/send-email', async (req: Request, res: Response) => {
  try {
    const animalId = String(req.body?.animalId || '')
    const name = String(req.body?.name || '')
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const vs = String(req.body?.vs || '')

    const amount = Number(req.body?.amountCZK || 0)
    const monthlyAmount = Math.round(amount)

    const jwtUserId = tryGetJwtUserId(req) // ✅ added (optional)

    if (!animalId) return res.status(400).json({ error: 'Missing animalId' })

    // ✅ only require email+name+password for guest flow
    if (!jwtUserId) {
      if (!email) return res.status(400).json({ error: 'Missing email' })
      if (!name) return res.status(400).json({ error: 'Missing name' })
      if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' })
    }

    if (!vs) return res.status(400).json({ error: 'Missing vs' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amountCZK' })

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, jmeno: true, name: true },
    })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    // ✅ if logged in -> use JWT userId; else keep existing behavior
    let userId: string
    let token: string

    if (jwtUserId) {
      userId = jwtUserId
      token = getBearerToken(req) || ''
    } else {
      const r = await ensureUserAndGetToken({ email, password, name })
      userId = r.userId
      token = r.token
    }

    // Ensure subscription exists (idempotent: if exists, don’t reset)
    const existing = await findSubscriptionByUserAnimal(userId, animalId)
    if (!existing) {
      const now = new Date()
      const tempAccessUntil = new Date(now.getTime() + 40 * 86400000)
      await prisma.subscription.create({
        data: {
          userId,
          animalId,
          status: SubscriptionStatus.PENDING,
          startedAt: now,
          monthlyAmount,
          provider: PaymentProvider.FIO,
          variableSymbol: vs,
          pendingSince: now,
          tempAccessUntil,
          graceUntil: null,
          reminderSentAt: null,
          reminderCount: 0,
        } as any,
      })
    } else if (!existing.variableSymbol && vs) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { variableSymbol: vs } as any,
      })
    }

    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const loginUrl = process.env.PATRON_LOGIN_URL || 'https://patron.dog-point.cz'

    const effectiveEmail = jwtUserId
      ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || email
      : email

    const pdf = await generateNicePdf({
      animalId,
      animalName: animal.jmeno || animal.name || 'Zvíře',
      amountCZK: monthlyAmount,
      bankIban,
      bankName,
      vs,
      email: effectiveEmail,
      password,
      loginUrl,
    })

    await sendPdfEmail({
      to: effectiveEmail,
      subject: 'Adopce – údaje k platbě',
      filename: `dogpoint-adopce-${animalId}.pdf`,
      pdfBuffer: pdf,
      loginUrl,
      email: effectiveEmail,
      password,
    })

    return res.json({ ok: true, token })
  } catch (e: any) {
    console.error('[adoption-bank/send-email]', e)
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed' })
  }
})

/**
 * OPTIONAL: “Zaplatil jsem” email + PDF (same attachment).
 * Frontend can call it when user clicks "Zaplatil jsem".
 */
router.post('/paid-email', async (req: Request, res: Response) => {
  try {
    const animalId = String(req.body?.animalId || '')
    const name = String(req.body?.name || '')
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const vs = String(req.body?.vs || '')

    const amount = Number(req.body?.amountCZK || 0)
    const monthlyAmount = Math.round(amount)

    const jwtUserId = tryGetJwtUserId(req) // ✅ added (optional)

    if (!animalId) return res.status(400).json({ error: 'Missing animalId' })

    // ✅ only require email+name+password for guest flow
    if (!jwtUserId) {
      if (!email) return res.status(400).json({ error: 'Missing email' })
      if (!name) return res.status(400).json({ error: 'Missing name' })
      if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' })
    }

    if (!vs) return res.status(400).json({ error: 'Missing vs' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amountCZK' })

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, jmeno: true, name: true },
    })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    // ✅ if logged in -> use JWT userId; else keep existing behavior
    let userId: string
    let token: string

    if (jwtUserId) {
      userId = jwtUserId
      token = getBearerToken(req) || ''
    } else {
      const r = await ensureUserAndGetToken({ email, password, name })
      userId = r.userId
      token = r.token
    }

    // Ensure subscription exists (do not reset)
    const existing = await findSubscriptionByUserAnimal(userId, animalId)
    if (!existing) {
      const now = new Date()
      const tempAccessUntil = new Date(now.getTime() + 40 * 86400000)
      await prisma.subscription.create({
        data: {
          userId,
          animalId,
          status: SubscriptionStatus.PENDING,
          startedAt: now,
          monthlyAmount,
          provider: PaymentProvider.FIO,
          variableSymbol: vs,
          pendingSince: now,
          tempAccessUntil,
          graceUntil: null,
          reminderSentAt: null,
          reminderCount: 0,
        } as any,
      })
    } else if (!existing.variableSymbol && vs) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { variableSymbol: vs } as any,
      })
    }

    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const loginUrl = process.env.PATRON_LOGIN_URL || 'https://patron.dog-point.cz'

    const effectiveEmail = jwtUserId
      ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || email
      : email

    const pdf = await generateNicePdf({
      animalId,
      animalName: animal.jmeno || animal.name || 'Zvíře',
      amountCZK: monthlyAmount,
      bankIban,
      bankName,
      vs,
      email: effectiveEmail,
      password,
      loginUrl,
    })

    await sendPdfEmail({
      to: effectiveEmail,
      subject: 'Děkujeme za adopci ❤️',
      filename: `dogpoint-adopce-${animalId}.pdf`,
      pdfBuffer: pdf,
      loginUrl,
      email: effectiveEmail,
      password,
    })

    return res.json({ ok: true, token })
  } catch (e: any) {
    console.error('[adoption-bank/paid-email]', e)
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed' })
  }
})

export default router