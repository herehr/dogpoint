// backend/src/routes/adoptionBank.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { SubscriptionStatus } from '@prisma/client'

const router = Router()

/**
 * Minimal PDF generator (Helvetica) - no external PDF libs.
 */
function makeSimplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  const startX = 50
  const startY = 800
  const lineHeight = 16

  const textOps = lines
    .map((line, i) => `1 0 0 1 ${startX} ${startY - i * lineHeight} Tm (${esc(line)}) Tj`)
    .join('\n')

  const content = `BT
/F1 12 Tf
${textOps}
ET`

  const contentBytes = Buffer.from(content, 'utf-8')
  const contentLen = contentBytes.length

  const parts: Buffer[] = []
  const offsets: number[] = []

  const push = (s: string | Buffer) => {
    const b = typeof s === 'string' ? Buffer.from(s, 'utf-8') : s
    parts.push(b)
  }

  push('%PDF-1.4\n')

  const addObj = (objNum: number, body: string | Buffer) => {
    offsets[objNum] = parts.reduce((sum, b) => sum + b.length, 0)
    push(`${objNum} 0 obj\n`)
    push(body)
    if (typeof body === 'string' && !body.endsWith('\n')) push('\n')
    push('endobj\n')
  }

  addObj(1, `<< /Type /Catalog /Pages 2 0 R >>\n`)
  addObj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n`)
  addObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]
/Resources << /Font << /F1 4 0 R >> >>
/Contents 5 0 R
>>\n`
  )
  addObj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n`)

  offsets[5] = parts.reduce((sum, b) => sum + b.length, 0)
  push(`5 0 obj\n`)
  push(`<< /Length ${contentLen} >>\nstream\n`)
  push(contentBytes)
  push(`\nendstream\nendobj\n`)

  const xrefStart = parts.reduce((sum, b) => sum + b.length, 0)
  const objCount = 6

  push('xref\n')
  push(`0 ${objCount}\n`)
  push('0000000000 65535 f \n')
  for (let i = 1; i < objCount; i++) {
    const off = offsets[i] ?? 0
    push(`${String(off).padStart(10, '0')} 00000 n \n`)
  }

  push('trailer\n')
  push(`<< /Size ${objCount} /Root 1 0 R >>\n`)
  push('startxref\n')
  push(`${xrefStart}\n`)
  push('%%EOF\n')

  return Buffer.concat(parts)
}

async function sendMailWithPdf(args: {
  to: string
  subject: string
  textLines: string[]
  filename: string
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

  const pdf = makeSimplePdf(args.textLines)

  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    html: `
      <p>Děkujeme! Vaše adopce byla aktivována na <b>30 dní</b>.</p>
      <p>V příloze posíláme PDF s pokyny pro bankovní převod.</p>
    `,
    attachments: [
      {
        filename: args.filename,
        content: pdf,
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

    // Upsert subscription as PENDING
    // ✅ IMPORTANT: monthlyAmount is REQUIRED in your schema -> always set it.
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
          monthlyAmount: Math.round(amountCZK), // ✅ required
          // If you later add bank VS fields, add them here too
          // bankVs: vs,
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
          monthlyAmount: Math.round(amountCZK), // ✅ required
          // bankVs: vs,
          // provider: 'BANK',
        } as any,
        select: { id: true },
      })
      subscriptionId = created.id
    }

    const token = jwt.sign({ sub: userId, id: userId, role: 'USER' }, JWT_SECRET, { expiresIn: '30d' })

    const bankIban = process.env.BANK_IBAN || process.env.DOGPOINT_IBAN || 'CZ6508000000001234567899'
    const bankName = process.env.BANK_NAME || 'Dogpoint o.p.s.'
    const animalName = animal.jmeno || animal.name || 'Zvíře'

    const lines = [
      'Režim adopce: bankovní převod (Internetbanking)',
      '',
      `Zvíře: ${animalName}`,
      `Částka: ${Math.round(amountCZK)} Kč / měsíc`,
      '',
      `Příjemce: ${bankName}`,
      `IBAN: ${bankIban}`,
      `Variabilní symbol (VS): ${vs}`,
      '',
      'Adopce je aktivní na 30 dní.',
      'Prosíme nastavte trvalý příkaz (měsíčně).',
    ]

    await sendMailWithPdf({
      to: email,
      subject: 'Pokyny pro bankovní převod – Dogpoint adopce',
      textLines: lines,
      filename: `dogpoint-bank-${animalId}.pdf`,
    })

    return res.json({ ok: true, token, userId, subscriptionId })
  } catch (e: any) {
    console.error('[adoption-bank/start] error:', e?.message || e)
    return res.status(500).json({ error: e?.message || 'Failed to start bank adoption' })
  }
})

export default router