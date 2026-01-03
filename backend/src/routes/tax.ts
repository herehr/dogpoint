// backend/src/routes/tax.ts
import { Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/authJwt'
import { Role } from '@prisma/client'
import { sendEmailSafe } from '../services/email'

const router = Router()

/**
 * Build a stable public URL for the frontend page.
 * Make sure APP_BASE_URL points to your frontend domain (dev/prod).
 * Example: https://dogpoint-frontend-xxxx.ondigitalocean.app
 * Example: https://patron.dog-point.cz
 */
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://patron.dog-point.cz'

function isAdmin(role?: string) {
  return role === Role.ADMIN || role === 'ADMIN'
}

function requireAdmin(req: any, res: Response): boolean {
  const role = String(req.user?.role || '')
  if (!isAdmin(role)) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

function makeToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex') // URL-safe
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

/** ---- helper: profile completeness ---- */
function profileComplete(p: any | null): boolean {
  if (!p) return false
  const s = (v: any) => (v ?? '').toString().trim()
  const isCompany = Boolean(p.isCompany)

  if (isCompany) {
    return !!s(p.companyName) && !!s(p.taxId) && !!s(p.street) && !!s(p.zip) && !!s(p.city)
  }
  return !!s(p.firstName) && !!s(p.lastName) && !!s(p.street) && !!s(p.zip) && !!s(p.city)
}

/* ──────────────────────────────────────────────
   PUBLIC
   GET /api/tax/token/:token
   Validate token + return user+existing profile
────────────────────────────────────────────── */
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ error: 'Missing token' })

    const row = await prisma.taxRequestToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            street: true,
            streetNo: true,
            zip: true,
            city: true,
            taxProfile: true,
          },
        },
      },
    })

    if (!row) return res.status(404).json({ error: 'Token not found' })
    if (row.usedAt) return res.status(410).json({ error: 'Token already used' })
    if (row.expiresAt && row.expiresAt.getTime() < Date.now())
      return res.status(410).json({ error: 'Token expired' })

    res.json({
      ok: true,
      token: row.token,
      expiresAt: row.expiresAt,
      user: {
        id: row.user.id,
        email: row.user.email,
      },
      // existing saved tax profile (if any)
      taxProfile: row.user.taxProfile,
      // defaults from User (so you can prefill)
      defaults: {
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        street: row.user.street,
        streetNo: row.user.streetNo,
        zip: row.user.zip,
        city: row.user.city,
      },
    })
  } catch (e) {
    console.error('[tax] GET /token/:token error', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* ──────────────────────────────────────────────
   PUBLIC
   POST /api/tax/token/:token
   Save data into TaxProfile + mark token used
────────────────────────────────────────────── */
router.post('/token/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ error: 'Missing token' })

    const row = await prisma.taxRequestToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!row) return res.status(404).json({ error: 'Token not found' })
    if (row.usedAt) return res.status(410).json({ error: 'Token already used' })
    if (row.expiresAt && row.expiresAt.getTime() < Date.now())
      return res.status(410).json({ error: 'Token expired' })

    const body = (req.body || {}) as any

    // Minimal normalization
    const payload = {
      isCompany: Boolean(body.isCompany),
      companyName: (body.companyName ?? '').toString().trim() || null,
      taxId: (body.taxId ?? '').toString().trim() || null,
      firstName: (body.firstName ?? '').toString().trim() || null,
      lastName: (body.lastName ?? '').toString().trim() || null,
      street: (body.street ?? '').toString().trim() || null,
      streetNo: (body.streetNo ?? '').toString().trim() || null,
      zip: (body.zip ?? '').toString().trim() || null,
      city: (body.city ?? '').toString().trim() || null,
    }

    // Upsert tax profile (1:1 via userId unique)
    const profile = await prisma.taxProfile.upsert({
      where: { userId: row.userId },
      create: { userId: row.userId, ...payload },
      update: { ...payload },
    })

    // Mark token used
    await prisma.taxRequestToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })

    res.json({ ok: true, profile })
  } catch (e) {
    console.error('[tax] POST /token/:token error', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* ──────────────────────────────────────────────
   ADMIN
   GET /api/tax/admin/users
   Returns all users with email + taxProfile status
────────────────────────────────────────────── */
router.get('/admin/users', requireAuth, async (req: any, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return

    const users = await prisma.user.findMany({
      select: { id: true, email: true, taxProfile: true },
      orderBy: { email: 'asc' },
    })

    res.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        hasTaxProfile: !!u.taxProfile,
        profileComplete: profileComplete(u.taxProfile),
      })),
    })
  } catch (e) {
    console.error('[tax] GET /admin/users error', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* ──────────────────────────────────────────────
   ADMIN
   POST /api/tax/send
   body: { email } or { userId } + optional { recheck?: boolean }
   Creates token + sends email
────────────────────────────────────────────── */
router.post('/send', requireAuth, async (req: any, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return

    const { email, userId, recheck } = (req.body || {}) as {
      email?: string
      userId?: string
      recheck?: boolean
    }

    if (!email && !userId) return res.status(400).json({ error: 'Missing email or userId' })

    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: String(email).trim().toLowerCase() },
      select: { id: true, email: true, taxRequestCount: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const token = makeToken(24)
    const expiresAt = addDays(new Date(), 30)

    await prisma.taxRequestToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        taxRequestSentAt: new Date(),
        taxRequestCount: { increment: 1 },
      },
    })

    const link = `${APP_BASE_URL}/udaje-pro-potvrzeni?token=${encodeURIComponent(token)}`
    const subject = recheck
      ? 'Dogpoint – prosíme o kontrolu údajů pro potvrzení o daru'
      : 'Dogpoint – údaje pro potvrzení o daru'

    const text = recheck
      ? `Dobrý den,

prosíme o kontrolu (a případnou opravu) údajů pro vystavení potvrzení o daru.

Otevřete tento odkaz:
${link}

Odkaz je platný do: ${expiresAt.toISOString().slice(0, 10)}

Děkujeme,
tým DOG-POINT
`
      : `Dobrý den,

prosíme o doplnění údajů pro vystavení potvrzení o daru.

Otevřete tento odkaz:
${link}

Odkaz je platný do: ${expiresAt.toISOString().slice(0, 10)}

Děkujeme,
tým DOG-POINT
`

    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif">
      <p>Dobrý den,</p>
      <p>${
        recheck
          ? 'prosíme o <strong>kontrolu</strong> (a případnou opravu) údajů pro vystavení <strong>potvrzení o daru</strong>.'
          : 'prosíme o <strong>doplnění</strong> údajů pro vystavení <strong>potvrzení o daru</strong>.'
      }</p>
      <p><a href="${link}">Otevřít formulář</a></p>
      <p style="color:#666;font-size:12px">Platnost odkazu do: ${expiresAt.toISOString().slice(0, 10)}</p>
      <p>Děkujeme,<br/>tým DOG-POINT</p>
    </body></html>`

    await sendEmailSafe({ to: user.email, subject, text, html })

    res.json({ ok: true, sentTo: user.email, expiresAt, link })
  } catch (e) {
    console.error('[tax] POST /send error', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* ──────────────────────────────────────────────
   ADMIN
   POST /api/tax/send-batch
   body: { emails?: string[], userIds?: string[], recheck?: boolean }
   Creates tokens + sends emails
────────────────────────────────────────────── */
router.post('/send-batch', requireAuth, async (req: any, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return

    const { emails, userIds, recheck } = (req.body || {}) as {
      emails?: string[]
      userIds?: string[]
      recheck?: boolean
    }

    const listEmails = Array.isArray(emails)
      ? emails.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : []
    const listIds = Array.isArray(userIds) ? userIds.map((s) => String(s).trim()).filter(Boolean) : []

    if (listEmails.length === 0 && listIds.length === 0)
      return res.status(400).json({ error: 'Missing emails or userIds' })

    const users = await prisma.user.findMany({
      where: {
        OR: [
          ...(listIds.length ? [{ id: { in: listIds } }] : []),
          ...(listEmails.length ? [{ email: { in: listEmails } }] : []),
        ],
      },
      select: { id: true, email: true },
    })

    const results: Array<{ email: string; ok: boolean; error?: string }> = []

    for (const u of users) {
      try {
        const token = makeToken(24)
        const expiresAt = addDays(new Date(), 30)

        await prisma.taxRequestToken.create({
          data: { token, userId: u.id, expiresAt },
        })

        await prisma.user.update({
          where: { id: u.id },
          data: { taxRequestSentAt: new Date(), taxRequestCount: { increment: 1 } },
        })

        const link = `${APP_BASE_URL}/udaje-pro-potvrzeni?token=${encodeURIComponent(token)}`
        const subject = recheck
          ? 'Dogpoint – prosíme o kontrolu údajů pro potvrzení o daru'
          : 'Dogpoint – údaje pro potvrzení o daru'

        const text = recheck
          ? `Dobrý den,

prosíme o kontrolu (a případnou opravu) údajů pro vystavení potvrzení o daru.

Otevřete tento odkaz:
${link}

Děkujeme,
tým DOG-POINT
`
          : `Dobrý den,

prosíme o doplnění údajů pro vystavení potvrzení o daru.

Otevřete tento odkaz:
${link}

Děkujeme,
tým DOG-POINT
`

        const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif">
          <p>Dobrý den,</p>
          <p>${
            recheck
              ? 'Prosíme o <strong>kontrolu</strong> (a případnou opravu) údajů pro potvrzení o daru.'
              : 'Prosíme o <strong>doplnění</strong> údajů pro potvrzení o daru.'
          }</p>
          <p><a href="${link}">Otevřít formulář</a></p>
          <p style="color:#666;font-size:12px">Platnost odkazu do: ${expiresAt.toISOString().slice(0, 10)}</p>
          <p>Děkujeme,<br/>Dogpoint</p>
        </body></html>`

        await sendEmailSafe({ to: u.email, subject, text, html })
        results.push({ email: u.email, ok: true })
      } catch (e: any) {
        results.push({ email: u.email, ok: false, error: e?.message || String(e) })
      }
    }

    res.json({ ok: true, processed: results.length, results })
  } catch (e) {
    console.error('[tax] POST /send-batch error', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router