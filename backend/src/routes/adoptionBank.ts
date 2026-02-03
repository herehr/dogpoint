// backend/src/routes/adoptionBank.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { SubscriptionStatus, PaymentProvider } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

const router = Router()

/* ──────────────────────────────────────────────
 * Helpers: robust asset path resolution
 * Works in src and in dist, and on DO where cwd differs.
 * PLUS: fallback to system DejaVu (apk add ttf-dejavu).
 * ──────────────────────────────────────────── */

function firstExistingPath(candidates: string[]): string | null {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p
    } catch {}
  }
  return null
}

/**
 * Resolve DejaVuSans.ttf in a way that works for:
 * - local dev (cwd repo root OR cwd backend/)
 * - compiled dist (where __dirname is dist/routes)
 * - production Docker/DO (cwd usually /app)
 * - Alpine system font paths (ttf-dejavu)
 */
function resolveFontPath(): string {
  const candidates = [
    // compiled dist: dist/routes -> ../../assets/fonts
    path.resolve(__dirname, '../../assets/fonts/DejaVuSans.ttf'),

    // local dev when running from backend/ (cwd=backend)
    path.resolve(process.cwd(), 'assets/fonts/DejaVuSans.ttf'),

    // local dev when running from repo root (cwd=repo)
    path.resolve(process.cwd(), 'backend/assets/fonts/DejaVuSans.ttf'),

    // DO/Docker absolute if you COPY assets -> /app/assets
    '/app/assets/fonts/DejaVuSans.ttf',
    '/app/backend/assets/fonts/DejaVuSans.ttf',

    // ✅ Alpine system paths (install with: apk add ttf-dejavu)
    '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/DejaVuSans.ttf',
  ]

  const found = firstExistingPath(candidates)
  if (!found) {
    throw new Error(
      `PDF font not found. Put DejaVuSans.ttf into backend/assets/fonts/DejaVuSans.ttf (or install ttf-dejavu). Tried:\n- ${candidates.join(
        '\n- ',
      )}`,
    )
  }
  return found
}

function resolveLogoPath(): string | null {
  const candidates = [
    // compiled dist
    path.resolve(__dirname, '../../assets/logo.png'),
    path.resolve(__dirname, '../../assets/logo.jpg'),

    // local dev cwd=backend
    path.resolve(process.cwd(), 'assets/logo.png'),
    path.resolve(process.cwd(), 'assets/logo.jpg'),

    // local dev cwd=repo root
    path.resolve(process.cwd(), 'backend/assets/logo.png'),
    path.resolve(process.cwd(), 'backend/assets/logo.jpg'),

    // DO/Docker absolute
    '/app/assets/logo.png',
    '/app/assets/logo.jpg',
    '/app/backend/assets/logo.png',
    '/app/backend/assets/logo.jpg',
  ]
  return firstExistingPath(candidates)
}

/* ──────────────────────────────────────────────
 * SPAYD
 * ──────────────────────────────────────────── */

function buildSpayd(params: { iban: string; amountCZK: number; vs: string; msg?: string }) {
  const iban = params.iban.replace(/\s+/g, '').toUpperCase()
  const amount = params.amountCZK.toFixed(2)

  const parts = ['SPD*1.0', `ACC:${iban}`, `AM:${amount}`, 'CC:CZK', `X-VS:${params.vs}`]

  const msg = (params.msg || '').trim()
  if (msg) {
    const safe = msg.replace(/\*/g, ' ').slice(0, 60)
    parts.push(`MSG:${safe}`)
  }

  return parts.join('*')
}

/* ──────────────────────────────────────────────
 * PDF generator: UTF-8 + QR + nice layout
 * ──────────────────────────────────────────── */

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

  if (process.env.NODE_ENV === 'production') {
    console.log('[PDF] Font OK:', fontPath)
    if (logoPath) console.log('[PDF] Logo OK:', logoPath)
  }

  const spayd = buildSpayd({
    iban: args.bankIban,
    amountCZK: args.amountCZK,
    vs: args.vs,
    msg: `Dogpoint adopce ${args.animalId}`,
  })

  const qrPngBuffer = await QRCode.toBuffer(spayd, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    type: 'png',
  })

  const doc = new PDFDocument({ size: 'A4', margin: 48 })
  const chunks: Buffer[] = []
  doc.on('data', (d: Buffer) => chunks.push(d))

  // ✅ UTF-8 safe font
  doc.registerFont('Body', fontPath)
  doc.font('Body')

  const pageWidth = doc.page.width
  const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right
  const x = doc.page.margins.left

  if (logoPath) {
    doc.image(logoPath, x, 28, { width: 140 })
  }
  doc
    .fontSize(20)
    .fillColor('#111')
    .text('Děkujeme za adopci ❤️', x, 40, { width: contentWidth, align: 'right' })

  doc.moveDown(2)

  const boxX = x
  const boxY = 120
  const boxW = contentWidth
  const boxH = 98

  doc.roundedRect(boxX, boxY, boxW, boxH, 10).fillAndStroke('#F6F8FF', '#D9E2FF')

  doc
    .fillColor('#111')
    .fontSize(12)
    .text('Váš účet je aktivován maximálně na 30 dní.', boxX + 16, boxY + 16, {
      width: boxW - 32,
    })
  doc
    .fillColor('#111')
    .fontSize(12)
    .text(
      'Prosíme, pošlete měsíční platbu co nejdříve a nastavte trvalý příkaz (direct debit).',
      boxX + 16,
      boxY + 38,
      { width: boxW - 32 },
    )
  doc
    .fillColor('#111')
    .fontSize(12)
    .text('Děkujeme vám – díky lidem jako jste vy můžeme pomáhat každý den.', boxX + 16, boxY + 62, {
      width: boxW - 32,
    })

  const sectionY = boxY + boxH + 24
  doc.fillColor('#111').fontSize(15).text('Údaje k bankovnímu převodu', boxX, sectionY)

  const leftColX = boxX
  const rightColX = boxX + Math.floor(contentWidth * 0.60)
  let y = sectionY + 28

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Zvíře', value: args.animalName },
    { label: 'Částka', value: `${args.amountCZK} Kč / měsíc` },
    { label: 'Příjemce', value: args.bankName },
    { label: 'IBAN', value: args.bankIban },
    { label: 'Variabilní symbol (VS)', value: args.vs },
  ]

  doc.fontSize(12)
  for (const r of rows) {
    doc.fillColor('#333').text(`${r.label}:`, leftColX, y, { width: rightColX - leftColX - 10 })
    doc.fillColor('#000').text(r.value, rightColX, y, { width: boxX + boxW - rightColX })
    y += 18
  }

  const qrBlockY = y + 16
  doc.roundedRect(boxX, qrBlockY, boxW, 192, 10).stroke('#E6E6E6')

  doc.fillColor('#111').fontSize(13).text('QR kód pro platbu (SPAYD)', boxX + 16, qrBlockY + 14)
  doc
    .fontSize(10)
    .fillColor('#555')
    .text('Naskenujte v bankovní aplikaci a zkontrolujte částku a VS.', boxX + 16, qrBlockY + 34)

  doc.image(qrPngBuffer, boxX + 16, qrBlockY + 58, { width: 130 })

  doc.fontSize(9).fillColor('#666').text('SPAYD:', boxX + 160, qrBlockY + 62)
  doc.fontSize(9).fillColor('#222').text(spayd, boxX + 160, qrBlockY + 76, { width: boxW - 176 })

  const loginY = qrBlockY + 210
  doc.fillColor('#111').fontSize(15).text('Přihlášení do účtu', boxX, loginY)

  doc.fontSize(12).fillColor('#111').text(`Web: ${args.loginUrl}`, boxX, loginY + 26)
  doc.text(`Uživatelské jméno: ${args.email}`, boxX, loginY + 44)
  doc.text(`Heslo: ${args.password}`, boxX, loginY + 62)

  doc
    .fontSize(10)
    .fillColor('#666')
    .text('Děkujeme, že pomáháte. Tým Dogpoint ❤️', boxX, 790, { width: boxW, align: 'center' })

  doc.end()
  await new Promise<void>((resolve) => doc.on('end', () => resolve()))
  return Buffer.concat(chunks)
}

/* ──────────────────────────────────────────────
 * Email sender
 * ──────────────────────────────────────────── */

async function sendMailWithPdf(args: {
  to: string
  subject: string
  filename: string
  pdfBuffer: Buffer
  loginUrl: string
  email: string
  password: string
}) {
  const nodemailerMod: any = await import('nodemailer')
  const nodemailer = nodemailerMod.default || nodemailerMod

  const host = process.env.EMAIL_HOST
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  const from = process.env.EMAIL_FROM || 'Dogpoint <info@dogpoint.cz>'
  const port = Number(process.env.EMAIL_PORT || 587)
  const secure = port === 465

  if (!host || !user || !pass) {
    throw new Error('EMAIL_* env vars missing (EMAIL_HOST, EMAIL_USER, EMAIL_PASS)')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    (process.env.DO_SPACE_PUBLIC_BASE
      ? `${process.env.DO_SPACE_PUBLIC_BASE.replace(/\/+$/, '')}/assets/logo.png`
      : '')

  const html = `
  <div style="font-family:Arial, sans-serif; max-width:640px; margin:0 auto; color:#111;">
    ${logoUrl ? `<div style="margin:10px 0 20px 0;"><img src="${logoUrl}" alt="Dogpoint" style="height:48px" /></div>` : ''}

    <h2 style="margin:0 0 12px 0;">Děkujeme za adopci ❤️</h2>

    <p style="margin:0 0 10px 0; line-height:1.5;">
      Váš účet je aktivován <b>maximálně na 30 dní</b>.
      Prosíme, pošlete měsíční platbu co nejdříve a nastavte <b>trvalý příkaz</b> (direct debit).
    </p>

    <p style="margin:0 0 10px 0; line-height:1.5;">
      Děkujeme vám. Díky lidem jako jste vy může Dogpoint pomáhat každý den.
    </p>

    <div style="background:#F6F8FF; border:1px solid #D9E2FF; border-radius:12px; padding:14px 16px; margin:16px 0;">
      <div style="font-weight:700; margin-bottom:8px;">Přihlášení do účtu</div>
      <div>Web: <a href="${args.loginUrl}" target="_blank" rel="noreferrer">${args.loginUrl}</a></div>
      <div>Uživatelské jméno: <b>${args.email}</b></div>
      <div>Heslo: <b>${args.password}</b></div>
    </div>

    <p style="margin:0 0 14px 0; line-height:1.5;">
      V příloze posíláme PDF s QR kódem a všemi údaji k převodu.
    </p>

    <p style="margin:0; color:#555;">Tým Dogpoint ❤️</p>
  </div>
  `

  await transporter.sendMail({
    from,
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

/* ──────────────────────────────────────────────
 * Internal auth helper (used for /start and /send-email)
 * ──────────────────────────────────────────── */

async function ensureUserAndGetToken(args: { email: string; password: string; name?: string }) {
  const bcryptMod: any = await import('bcryptjs')
  const bcrypt = bcryptMod.default || bcryptMod

  const jwtMod: any = await import('jsonwebtoken')
  const jwt = jwtMod.default || jwtMod

  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) throw new Error('JWT_SECRET missing')

  const existing = await prisma.user.findUnique({ where: { email: args.email } })

  let userId: string
  if (!existing) {
    const passwordHash = await bcrypt.hash(args.password, 10)
    const created = await prisma.user.create({
      data: {
        email: args.email,
        passwordHash,
        role: 'USER' as any,
        firstName: args.name || undefined,
      } as any,
      select: { id: true },
    })
    userId = created.id
  } else {
    userId = existing.id

    const hasHash = Boolean((existing as any).passwordHash)
    if (hasHash) {
      const ok = await bcrypt.compare(args.password, (existing as any).passwordHash)
      if (!ok) {
        const err: any = new Error('Špatné heslo.')
        err.status = 401
        throw err
      }
    } else {
      const passwordHash = await bcrypt.hash(args.password, 10)
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } as any })
    }

    if (!(existing as any).firstName && args.name) {
      await prisma.user.update({ where: { id: userId }, data: { firstName: args.name } as any })
    }
  }

  const token = jwt.sign({ sub: userId, id: userId, role: 'USER' }, JWT_SECRET, { expiresIn: '30d' })
  return { userId, token }
}

/* ──────────────────────────────────────────────
 * POST /api/adoption-bank/start  (PUBLIC)
 * body: { animalId, amountCZK, name, email, password, vs, sendEmail? }
 *
 * ✅ Backward-compatible:
 * - default sendEmail=true (old behavior)
 * - sendEmail=false enables 2-step UI: show instructions first, email later
 * ──────────────────────────────────────────── */

router.post('/start', async (req: Request, res: Response) => {
  try {
    const animalId = req.body?.animalId ? String(req.body.animalId) : ''
    const amountCZK = Number(req.body?.amountCZK || 0)
    const name = req.body?.name ? String(req.body.name) : ''
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : ''
    const password = req.body?.password ? String(req.body.password) : ''
    const vs = req.body?.vs ? String(req.body.vs) : ''
    const sendEmail = req.body?.sendEmail === undefined ? true : Boolean(req.body.sendEmail)

    if (!animalId) return res.status(400).json({ error: 'Missing animalId' })
    if (!email) return res.status(400).json({ error: 'Missing email' })
    if (!name) return res.status(400).json({ error: 'Missing name' })
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' })
    if (!vs) return res.status(400).json({ error: 'Missing vs' })
    if (!Number.isFinite(amountCZK) || amountCZK <= 0) return res.status(400).json({ error: 'Invalid amountCZK' })

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, jmeno: true, name: true },
    })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    // ensure user + token
    let userId: string
    let token: string
    try {
      const auth = await ensureUserAndGetToken({ email, password, name })
      userId = auth.userId
      token = auth.token
    } catch (e: any) {
      const status = e?.status || 500
      return res.status(status).json({ error: e?.message || 'Auth failed' })
    }

    const monthlyAmount = Math.round(amountCZK)
    const provider = PaymentProvider.FIO

    const now = new Date()
    const tempAccessUntil = new Date(now.getTime())
    tempAccessUntil.setDate(tempAccessUntil.getDate() + 40)

    const current = await prisma.subscription.findFirst({
      where: {
        userId,
        animalId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
      },
      select: { id: true },
    })

    let subscriptionId: string
    if (current) {
      const updated = await prisma.subscription.update({
        where: { id: current.id },
        data: {
          status: SubscriptionStatus.PENDING,
          startedAt: now,
          monthlyAmount,
          provider,

          pendingSince: now,
          tempAccessUntil,

          // Prisma strict: do not write null unless your schema is nullable
          graceUntil: undefined,
          reminderSentAt: undefined,
          reminderCount: 0,
        } as any,
        select: { id: true },
      })
      subscriptionId = updated.id
    } else {
      const created = await prisma.subscription.create({
        data: {
          userId,
          animalId,
          status: SubscriptionStatus.PENDING,
          startedAt: now,
          monthlyAmount,
          provider,

          pendingSince: now,
          tempAccessUntil,

          graceUntil: undefined,
          reminderSentAt: undefined,
          reminderCount: 0,
        } as any,
        select: { id: true },
      })
      subscriptionId = created.id
    }

    // Bank constants
    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const animalName = animal.jmeno || animal.name || 'Zvíře'
    const loginUrl = process.env.PATRON_LOGIN_URL || 'https://patron.dog-point.cz'

    // optional email now (old flow)
    if (sendEmail) {
      const pdfBuffer = await generateNicePdf({
        animalId,
        animalName,
        amountCZK: monthlyAmount,
        bankIban,
        bankName,
        vs,
        email,
        password,
        loginUrl,
      })

      await sendMailWithPdf({
        to: email,
        subject: 'Děkujeme za adopci – pokyny k bankovnímu převodu',
        filename: `dogpoint-adopce-${animalId}.pdf`,
        pdfBuffer,
        loginUrl,
        email,
        password,
      })
    }

    return res.json({
      ok: true,
      token,
      userId,
      subscriptionId,
      bankIban,
      bankName,
      vs,
      amountCZK: monthlyAmount,
      sendEmail,
    })
  } catch (e: any) {
    console.error('[adoption-bank/start] error:', e?.message || e)
    return res.status(500).json({ error: e?.message || 'Failed to start bank adoption' })
  }
})

/* ──────────────────────────────────────────────
 * POST /api/adoption-bank/send-email (PUBLIC)
 * body: { animalId, amountCZK, name, email, password, vs }
 * Used for the 2-step UI button: "Send me the payment details by E-mail"
 * ──────────────────────────────────────────── */

router.post('/send-email', async (req: Request, res: Response) => {
  try {
    const animalId = req.body?.animalId ? String(req.body.animalId) : ''
    const amountCZK = Number(req.body?.amountCZK || 0)
    const name = req.body?.name ? String(req.body.name) : ''
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : ''
    const password = req.body?.password ? String(req.body.password) : ''
    const vs = req.body?.vs ? String(req.body.vs) : ''

    if (!animalId) return res.status(400).json({ error: 'Missing animalId' })
    if (!email) return res.status(400).json({ error: 'Missing email' })
    if (!name) return res.status(400).json({ error: 'Missing name' })
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' })
    if (!vs) return res.status(400).json({ error: 'Missing vs' })
    if (!Number.isFinite(amountCZK) || amountCZK <= 0) return res.status(400).json({ error: 'Invalid amountCZK' })

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, jmeno: true, name: true },
    })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    // verify user password (and return token as convenience)
    let token: string
    try {
      const auth = await ensureUserAndGetToken({ email, password, name })
      token = auth.token
    } catch (e: any) {
      const status = e?.status || 500
      return res.status(status).json({ error: e?.message || 'Auth failed' })
    }

    const monthlyAmount = Math.round(amountCZK)
    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const animalName = animal.jmeno || animal.name || 'Zvíře'
    const loginUrl = process.env.PATRON_LOGIN_URL || 'https://patron.dog-point.cz'

    const pdfBuffer = await generateNicePdf({
      animalId,
      animalName,
      amountCZK: monthlyAmount,
      bankIban,
      bankName,
      vs,
      email,
      password,
      loginUrl,
    })

    await sendMailWithPdf({
      to: email,
      subject: 'Děkujeme za adopci – pokyny k bankovnímu převodu',
      filename: `dogpoint-adopce-${animalId}.pdf`,
      pdfBuffer,
      loginUrl,
      email,
      password,
    })

    return res.json({ ok: true, token })
  } catch (e: any) {
    console.error('[adoption-bank/send-email] error:', e?.message || e)
    return res.status(500).json({ error: e?.message || 'Failed to send email' })
  }
})

export default router