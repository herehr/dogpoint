// backend/src/routes/adoptionBank.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { SubscriptionStatus, PaymentProvider } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

const router = Router()

/**
 * Build SPAYD payload (Czech banking QR).
 * Note: Keep it simple; most apps accept this.
 */
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

/**
 * Generates a nice UTF-8 PDF with QR code and payment details.
 * IMPORTANT: Use a UTF-8 capable font (DejaVuSans recommended).
 */
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
  const fontPath =
    process.env.PDF_FONT_PATH ||
    path.join(process.cwd(), 'dist', 'assets', 'fonts', 'DejaVuSans.ttf')

  const logoPath =
    process.env.PDF_LOGO_PATH || path.join(process.cwd(), 'dist', 'assets', 'logo.png')

  const hasFont = fs.existsSync(fontPath)
  const hasLogo = fs.existsSync(logoPath)

  // SPAYD + QR
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

  // Use UTF-8 font (required for Czech diacritics)
  if (hasFont) {
    doc.registerFont('Body', fontPath)
    doc.font('Body')
  } else {
    // Fallback: Helvetica (⚠ diacritics may break)
    doc.font('Helvetica')
  }

  const pageWidth = doc.page.width
  const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right

  // Header
  if (hasLogo) {
    doc.image(logoPath, doc.page.margins.left, 28, { width: 140 })
  }

  doc
    .fontSize(20)
    .fillColor('#111')
    .text('Děkujeme za adopci ❤️', doc.page.margins.left, 40, {
      width: contentWidth,
      align: 'right',
    })

  doc.moveDown(2)

  // Intro box
  const boxX = doc.page.margins.left
  const boxY = 120
  const boxW = contentWidth
  const boxH = 92

  doc
    .roundedRect(boxX, boxY, boxW, boxH, 10)
    .fillAndStroke('#F6F8FF', '#D9E2FF')

  doc
    .fillColor('#111')
    .fontSize(12)
    .text(
      'Váš účet je aktivní maximálně na 30 dní.',
      boxX + 16,
      boxY + 16,
      { width: boxW - 32 }
    )

  doc
    .fillColor('#111')
    .fontSize(12)
    .text(
      'Prosíme, pošlete měsíční platbu co nejdříve a nastavte trvalý příkaz.',
      boxX + 16,
      boxY + 36,
      { width: boxW - 32 }
    )

  doc
    .fillColor('#111')
    .fontSize(12)
    .text(
      'Děkujeme vám – díky lidem jako jste vy můžeme pomáhat každý den.',
      boxX + 16,
      boxY + 58,
      { width: boxW - 32 }
    )

  doc.moveTo(boxX, boxY + boxH + 26)

  // Payment section
  const sectionY = boxY + boxH + 28
  doc
    .fillColor('#111')
    .fontSize(15)
    .text('Údaje k bankovnímu převodu', boxX, sectionY)

  doc
    .moveDown(0.8)
    .fontSize(12)
    .fillColor('#111')

  const leftColX = boxX
  const rightColX = boxX + Math.floor(contentWidth * 0.60)
  const rowY = sectionY + 30

  const labelColor = '#333'
  const valueColor = '#000'

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Zvíře', value: args.animalName },
    { label: 'Částka', value: `${args.amountCZK} Kč / měsíc` },
    { label: 'Příjemce', value: args.bankName },
    { label: 'IBAN', value: args.bankIban },
    { label: 'Variabilní symbol (VS)', value: args.vs },
  ]

  let y = rowY
  for (const r of rows) {
    doc.fillColor(labelColor).text(`${r.label}:`, leftColX, y, { width: rightColX - leftColX - 10 })
    doc.fillColor(valueColor).text(r.value, rightColX, y, { width: boxX + boxW - rightColX })
    y += 18
  }

  // QR block
  const qrBlockY = y + 16
  doc
    .roundedRect(boxX, qrBlockY, boxW, 190, 10)
    .stroke('#E6E6E6')

  doc
    .fillColor('#111')
    .fontSize(13)
    .text('QR kód pro platbu (SPAYD)', boxX + 16, qrBlockY + 14)

  doc
    .fontSize(10)
    .fillColor('#555')
    .text('Naskenujte v bankovní aplikaci a zkontrolujte částku + VS.', boxX + 16, qrBlockY + 34)

  doc.image(qrPngBuffer, boxX + 16, qrBlockY + 58, { width: 130 })

  doc
    .fontSize(9)
    .fillColor('#666')
    .text('SPAYD:', boxX + 160, qrBlockY + 62)
  doc
    .fontSize(9)
    .fillColor('#222')
    .text(spayd, boxX + 160, qrBlockY + 76, { width: boxW - 176 })

  // Login section
  const loginY = qrBlockY + 205
  doc
    .fillColor('#111')
    .fontSize(15)
    .text('Přihlášení do účtu', boxX, loginY)

  doc
    .moveDown(0.5)
    .fontSize(12)
    .fillColor('#111')
    .text(`Web: ${args.loginUrl}`, boxX, loginY + 26)

  doc
    .fontSize(12)
    .text(`Uživatelské jméno: ${args.email}`, boxX, loginY + 44)

  doc
    .fontSize(12)
    .text(`Heslo: ${args.password}`, boxX, loginY + 62)

  // Footer
  doc
    .fontSize(10)
    .fillColor('#666')
    .text('Děkujeme, že pomáháte. Tým Dogpoint ❤️', boxX, 790, { width: boxW, align: 'center' })

  doc.end()

  await new Promise<void>((resolve) => doc.on('end', () => resolve()))
  return Buffer.concat(chunks)
}

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

  // Logo in email (use URL)
  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    process.env.DO_SPACE_PUBLIC_BASE?.replace(/\/+$/, '') + '/assets/logo.png'

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color:#111;">
    ${logoUrl ? `<div style="margin: 10px 0 20px 0;"><img src="${logoUrl}" alt="Dogpoint" style="height:48px"/></div>` : ''}

    <h2 style="margin:0 0 12px 0;">Děkujeme za adopci ❤️</h2>

    <p style="margin:0 0 10px 0; line-height:1.5;">
      Váš účet je aktivován <b>maximálně na 30 dní</b>.
      Prosíme, pošlete měsíční platbu co nejdříve a nastavte <b>trvalý příkaz</b>.
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

/**
 * POST /api/adoption-bank/start  (PUBLIC)
 * body: { animalId, amountCZK, name, email, password, vs }
 */
router.post('/start', async (req: Request, res: Response) => {
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

    const bcryptMod: any = await import('bcryptjs')
    const bcrypt = bcryptMod.default || bcryptMod

    const jwtMod: any = await import('jsonwebtoken')
    const jwt = jwtMod.default || jwtMod

    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET missing' })

    const existing = await prisma.user.findUnique({ where: { email } })

    let userId: string
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10)
      const created = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'USER' as any,
          firstName: name,
        } as any,
        select: { id: true },
      })
      userId = created.id
    } else {
      userId = existing.id

      const hasHash = Boolean((existing as any).passwordHash)
      if (hasHash) {
        const ok = await bcrypt.compare(password, (existing as any).passwordHash)
        if (!ok) return res.status(401).json({ error: 'Špatné heslo.' })
      } else {
        const passwordHash = await bcrypt.hash(password, 10)
        await prisma.user.update({
          where: { id: userId },
          data: { passwordHash } as any,
        })
      }

      if (!(existing as any).firstName && name) {
        await prisma.user.update({ where: { id: userId }, data: { firstName: name } as any })
      }
    }

    // ✅ Required fields in your schema
    const monthlyAmount = Math.round(amountCZK)
    const provider = PaymentProvider.FIO

    // Upsert subscription as PENDING
    const now = new Date()
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
        } as any,
        select: { id: true },
      })
      subscriptionId = created.id
    }

    const token = jwt.sign({ sub: userId, id: userId, role: 'USER' }, JWT_SECRET, { expiresIn: '30d' })

    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const animalName = animal.jmeno || animal.name || 'Zvíře'
    const loginUrl = 'https://patron.dog-point.cz'

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

    return res.json({ ok: true, token, userId, subscriptionId })
  } catch (e: any) {
    console.error('[adoption-bank/start] error:', e?.message || e)
    return res.status(500).json({ error: e?.message || 'Failed to start bank adoption' })
  }
})

export default router