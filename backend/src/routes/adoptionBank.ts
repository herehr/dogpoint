// backend/src/routes/adoptionBank.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { SubscriptionStatus, PaymentProvider } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { sendEmailSafe } from '../services/email'

const router = Router()

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
  ]

  const found = firstExistingPath(candidates)
  if (!found) {
    throw new Error('PDF font DejaVuSans.ttf not found')
  }
  return found
}

function resolveLogoPath(): string | null {
  return firstExistingPath([
    path.resolve(__dirname, '../../assets/logo.png'),
    path.resolve(process.cwd(), 'assets/logo.png'),
    path.resolve(process.cwd(), 'backend/assets/logo.png'),
    '/app/assets/logo.png',
    '/app/backend/assets/logo.png',
  ])
}

/* ────────────────────────────────────────────── */
/* SPAYD                                          */
/* ────────────────────────────────────────────── */

function buildSpayd(params: { iban: string; amountCZK: number; vs: string; msg?: string }) {
  const iban = params.iban.replace(/\s+/g, '').toUpperCase()
  const amount = params.amountCZK.toFixed(2)

  const parts = ['SPD*1.0', `ACC:${iban}`, `AM:${amount}`, 'CC:CZK', `X-VS:${params.vs}`]
  if (params.msg) parts.push(`MSG:${params.msg.replace(/\*/g, ' ').slice(0, 60)}`)
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
  doc.on('data', (d) => chunks.push(d))

  doc.registerFont('Body', fontPath)
  doc.font('Body')

  if (logoPath) doc.image(logoPath, 48, 28, { width: 140 })

  doc.fontSize(20).text('Děkujeme za adopci ❤️', { align: 'right' })
  doc.moveDown(2)

  doc.fontSize(12).text('Údaje k bankovnímu převodu')
  doc.moveDown()

  doc.text(`Zvíře: ${args.animalName}`)
  doc.text(`Částka: ${args.amountCZK} Kč / měsíc`)
  doc.text(`Příjemce: ${args.bankName}`)
  doc.text(`IBAN: ${args.bankIban}`)
  doc.text(`VS: ${args.vs}`)

  doc.moveDown()
  doc.image(qr, { width: 140 })

  doc.moveDown()
  doc.text(`Přihlášení: ${args.loginUrl}`)
  doc.text(`E-mail: ${args.email}`)
  doc.text(`Heslo: ${args.password}`)

  doc.end()
  await new Promise((r) => doc.on('end', r))
  return Buffer.concat(chunks)
}

/* ────────────────────────────────────────────── */
/* EMAIL (USING SHARED MAILER)                     */
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
  const html = `
    <h2>Děkujeme za adopci ❤️</h2>
    <p>V příloze najdete PDF s QR kódem a údaji k platbě.</p>
    <p>
      Přihlášení: <a href="${args.loginUrl}">${args.loginUrl}</a><br/>
      E-mail: <b>${args.email}</b><br/>
      Heslo: <b>${args.password}</b>
    </p>
  `

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
  const bcrypt = (await import('bcryptjs')).default
  const jwt = (await import('jsonwebtoken')).default

  const JWT_SECRET = process.env.JWT_SECRET!
  const existing = await prisma.user.findUnique({ where: { email: args.email } })

  let userId: string
  if (!existing) {
    const hash = await bcrypt.hash(args.password, 10)
    const u = await prisma.user.create({
      data: { email: args.email, passwordHash: hash, role: 'USER', firstName: args.name },
    })
    userId = u.id
  } else {
    userId = existing.id
    if (!(await bcrypt.compare(args.password, existing.passwordHash!))) {
      throw Object.assign(new Error('Špatné heslo'), { status: 401 })
    }
  }

  const token = jwt.sign({ id: userId, role: 'USER' }, JWT_SECRET, { expiresIn: '30d' })
  return { userId, token }
}

/* ────────────────────────────────────────────── */
/* ROUTES                                         */
/* ────────────────────────────────────────────── */

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { animalId, amountCZK, name, email, password, vs, sendEmail = true } = req.body

    const animal = await prisma.animal.findUnique({ where: { id: animalId } })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    const { userId, token } = await ensureUserAndGetToken({ email, password, name })

    const now = new Date()
    const tempAccessUntil = new Date(now.getTime() + 40 * 86400000)

    await prisma.subscription.upsert({
      where: { userId_animalId: { userId, animalId } },
      update: { status: 'PENDING', pendingSince: now, tempAccessUntil },
      create: {
        userId,
        animalId,
        status: 'PENDING',
        provider: PaymentProvider.FIO,
        startedAt: now,
        pendingSince: now,
        tempAccessUntil,
        monthlyAmount: amountCZK,
      },
    })

    if (sendEmail) {
      const pdf = await generateNicePdf({
        animalId,
        animalName: animal.jmeno || animal.name!,
        amountCZK,
        bankIban: process.env.BANK_IBAN!,
        bankName: process.env.BANK_NAME || 'Dogpoint',
        vs,
        email,
        password,
        loginUrl: process.env.PATRON_LOGIN_URL!,
      })

      await sendPdfEmail({
        to: email,
        subject: 'Dogpoint – pokyny k bankovnímu převodu',
        filename: `dogpoint-${animalId}.pdf`,
        pdfBuffer: pdf,
        loginUrl: process.env.PATRON_LOGIN_URL!,
        email,
        password,
      })
    }

    res.json({ ok: true, token })
  } catch (e: any) {
    console.error('[adoption-bank/start]', e)
    res.status(e.status || 500).json({ error: e.message })
  }
})

router.post('/send-email', async (req: Request, res: Response) => {
  try {
    const { animalId, amountCZK, name, email, password, vs } = req.body
    const animal = await prisma.animal.findUnique({ where: { id: animalId } })
    if (!animal) return res.status(404).json({ error: 'Animal not found' })

    const { token } = await ensureUserAndGetToken({ email, password, name })

    const pdf = await generateNicePdf({
      animalId,
      animalName: animal.jmeno || animal.name!,
      amountCZK,
      bankIban: process.env.BANK_IBAN!,
      bankName: process.env.BANK_NAME || 'Dogpoint',
      vs,
      email,
      password,
      loginUrl: process.env.PATRON_LOGIN_URL!,
    })

    await sendPdfEmail({
      to: email,
      subject: 'Dogpoint – pokyny k bankovnímu převodu',
      filename: `dogpoint-${animalId}.pdf`,
      pdfBuffer: pdf,
      loginUrl: process.env.PATRON_LOGIN_URL!,
      email,
      password,
    })

    res.json({ ok: true, token })
  } catch (e: any) {
    console.error('[adoption-bank/send-email]', e)
    res.status(e.status || 500).json({ error: e.message })
  }
})

export default router