// backend/src/routes/auth.ts
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../prisma'
import { Role } from '@prisma/client'
import { sendEmailSafe } from '../services/email'
import { linkPaidOrRecentPledgesToUser } from '../controllers/authExtra'

const router = Router()

/* =========================================================
   JWT helper
   ========================================================= */

function signToken(user: { id: string; role: Role | string; email: string }) {
  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) throw new Error('Server misconfigured: JWT_SECRET missing')
  const options: SignOptions = { expiresIn: '7d' }
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    rawSecret as Secret,
    options,
  )
}

/* =========================================================
   Config
   ========================================================= */

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://patron.dog-point.cz'

/* =========================================================
   Helper: do NOT break auth if pledge-linking fails
   ========================================================= */

function safeLinkPledges(userId: string, email: string, label: string) {
  // Never block login/register due to backfill/linking. Log and continue.
  linkPaidOrRecentPledgesToUser(userId, email).catch((e: any) => {
    console.error(`[auth/${label}] linkPaidOrRecentPledgesToUser failed:`, e?.message || e)
  })
}

/* =========================================================
   GET /api/auth/me
   Returns basic user + subscription animalIds
   ========================================================= */

router.get('/me', async (req: Request, res: Response) => {
  try {
    const hdr = req.headers.authorization || ''
    const m = hdr.match(/^Bearer\s+(.+)$/i)
    if (!m) return res.status(401).json({ error: 'Unauthorized' })

    const secret = process.env.JWT_SECRET as Secret | undefined
    if (!secret) return res.status(500).json({ error: 'Server misconfigured' })

    const payload = jwt.verify(m[1], secret) as any

    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, email: true, role: true },
    })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const subs = await prisma.subscription.findMany({
      where: { userId: user.id, status: { in: ['ACTIVE', 'PENDING'] } },
      select: { animalId: true },
    })

    res.json({
      ...user,
      animals: subs.map((s) => s.animalId),
      subscriptions: subs,
    })
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
})

/* =========================================================
   POST /api/auth/login
   body: { email, password }
   ========================================================= */

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as {
      email?: string
      password?: string
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.passwordHash) return res.status(409).json({ error: 'PASSWORD_NOT_SET' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    // ✅ do not block auth if this fails
    safeLinkPledges(user.id, user.email, 'login')

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ token, role: user.role })
  } catch (e: any) {
    console.error('POST /api/auth/login error:', e?.message || e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/set-password-first-time
   body: { email, password }
   ========================================================= */

router.post('/set-password-first-time', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as {
      email?: string
      password?: string
    }

    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.passwordHash) return res.status(409).json({ error: 'PASSWORD_ALREADY_SET' })

    const passwordHash = await bcrypt.hash(password, 10)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // ✅ do not block auth if this fails
    safeLinkPledges(updated.id, updated.email, 'set-password-first-time')

    const token = signToken({ id: updated.id, role: updated.role, email: updated.email })
    res.json({ ok: true, token, role: updated.role })
  } catch (e: any) {
    console.error('POST /api/auth/set-password-first-time error:', e?.message || e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/register-after-payment
   body: { email, password }
   ========================================================= */

router.post('/register-after-payment', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body || {}) as {
      email?: string
      password?: string
    }

    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })

    const passwordHash = await bcrypt.hash(password, 10)

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({ data: { email, passwordHash, role: Role.USER } })
    } else if (!user.passwordHash) {
      user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    }

    // ✅ do not block auth if this fails
    safeLinkPledges(user.id, user.email, 'register-after-payment')

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('POST /api/auth/register-after-payment error:', e?.message || e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/claim-paid
   body: { email, sessionId? }
   ========================================================= */

router.post('/claim-paid', async (req: Request, res: Response) => {
  try {
    const { email, sessionId } = (req.body || {}) as {
      email?: string
      sessionId?: string
    }

    if (!email) return res.status(400).json({ error: 'Missing email' })

    if (sessionId) {
      await prisma.pledge.updateMany({ where: { providerId: sessionId }, data: { email } })
    }

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) user = await prisma.user.create({ data: { email, role: Role.USER } })

    // ✅ do not block auth if this fails
    safeLinkPledges(user.id, user.email, 'claim-paid')

    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({ ok: true, token, role: user.role })
  } catch (e: any) {
    console.error('POST /api/auth/claim-paid error:', e?.message || e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/debug-backfill-adoptions
   body: { email }
   (kept strict – intended to fail loudly for debugging)
   ========================================================= */

router.post('/debug-backfill-adoptions', async (req: Request, res: Response) => {
  try {
    const { email } = (req.body || {}) as { email?: string }
    if (!email) return res.status(400).json({ error: 'Missing email' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const result = await linkPaidOrRecentPledgesToUser(user.id, user.email, {
      graceMinutes: 60 * 24 * 365,
    })

    res.json({ ok: true, processed: result.processed })
  } catch (e: any) {
    console.error('[debug-backfill-adoptions] error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})

/* =========================================================
   POST /api/auth/forgot-password
   body: { email }
   Always responds 200 generic (never leaks existence)
   ========================================================= */

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const raw = (req.body?.email ?? '') as string
  const email = raw.trim().toLowerCase()
  if (!email) {
    res.status(400).json({ error: 'Email je povinný' })
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // ✅ never reveal existence
    if (!user) {
      res.json({
        ok: true,
        message: 'Pokud u nás tento e-mail existuje, poslali jsme odkaz pro obnovu hesla.',
      })
      return
    }

    const secret = process.env.JWT_SECRET as Secret | undefined
    if (!secret) {
      console.error('[forgot-password] Missing JWT_SECRET')
      res.status(500).json({ error: 'Server misconfiguration' })
      return
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, type: 'password-reset' },
      secret,
      { expiresIn: '1h' },
    )

    const link = `${APP_BASE_URL}/obnovit-heslo?token=${encodeURIComponent(token)}`
    const subject = 'Dogpoint – obnova hesla k vašemu účtu'

    const textBody = `Dobrý den,

obdrželi jsme žádost o obnovu hesla k uživatelskému účtu registrovanému na tuto e-mailovou adresu.

Pokud jste o změnu hesla požádali vy, otevřete tento odkaz a nastavte si nové heslo:
${link}

Odkaz je platný 1 hodinu. Pokud jste o obnovu hesla nežádali, můžete tento e-mail ignorovat.

Bezpečnostní upozornění: Dogpoint po vás nikdy nebude chtít heslo e-mailem ani telefonicky.

Kontakty:
Telefon: +420 607 018 218
E-mail: info@dog-point.cz

Adresa útulku:
Lhotky 60
281 63 Malotice

Sídlo organizace a korespondenční kontakt:
Dogpoint o.p.s.
Milánská 452
109 00 Praha 15

S pozdravem
tým DOG-POINT
`

    const htmlBody = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Dogpoint – obnova hesla</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Odkaz pro obnovu hesla k vašemu účtu Dogpoint (platí 1 hodinu).
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0"
            style="width:600px;max-width:92vw;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="padding:22px 24px;background:#fff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <img src="https://patron.dog-point.cz/logo1.png"
                           alt="Dogpoint"
                           style="height:42px;display:block;border:0;outline:none;" />
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;color:#666;">
                      patron.dog-point.cz
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:800;">
                  Obnova hesla
                </h1>

                <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#222;">
                  Dobrý den,<br />
                  obdrželi jsme žádost o <strong>obnovu hesla</strong> k uživatelskému účtu registrovanému na tuto e-mailovou adresu.
                </p>

                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#222;">
                  Pokud jste o změnu hesla požádali vy, klikněte na tlačítko níže a nastavte si nové heslo:
                </p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
                  <tr>
                    <td align="center" bgcolor="#111111" style="border-radius:10px;">
                      <a href="${link}"
                         style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                        Nastavit nové heslo
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#444;">
                  Odkaz je platný <strong>1 hodinu</strong>. Pokud jste o obnovu hesla nežádali, můžete tento e-mail ignorovat.
                </p>

                <div style="margin:16px 0 0;padding:12px 14px;background:#f3f4f6;border-radius:10px;font-size:13px;line-height:1.6;color:#111;">
                  <strong>Bezpečnostní upozornění:</strong> Dogpoint po vás nikdy nebude chtít heslo e-mailem ani telefonicky.
                </div>

                <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#666;">
                  Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:<br />
                  <a href="${link}" style="color:#111;word-break:break-all;">${link}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 24px;background:#fafafa;border-top:1px solid #eee;">
                <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:#444;">
                  S pozdravem<br />
                  <strong>tým DOG-POINT</strong>
                </p>

                <p style="margin:0;font-size:12px;line-height:1.6;color:#666;">
                  <strong>Kontakty</strong><br />
                  Telefon: +420 607 018 218<br />
                  E-mail: <a href="mailto:info@dog-point.cz" style="color:#111;">info@dog-point.cz</a>
                </p>

                <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#666;">
                  <strong>Adresa útulku</strong><br />
                  Lhotky 60, 281 63 Malotice
                </p>

                <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#666;">
                  <strong>Sídlo organizace a korespondenční kontakt</strong><br />
                  Dogpoint o.p.s., Milánská 452, 109 00 Praha 15
                </p>
              </td>
            </tr>

          </table>

          <div style="width:600px;max-width:92vw;margin:10px auto 0;font-size:11px;color:#999;text-align:center;">
            Tento e-mail byl odeslán automaticky. Prosím neodpovídejte na něj.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`

    await sendEmailSafe({
      to: user.email,
      subject,
      text: textBody,
      html: htmlBody,
    })

    res.json({
      ok: true,
      message: 'Pokud u nás tento e-mail existuje, poslali jsme odkaz pro obnovu hesla.',
    })
  } catch (e: any) {
    console.error('POST /api/auth/forgot-password error:', e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/* =========================================================
   POST /api/auth/reset-password
   body: { token, password }
   ========================================================= */

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { token, password } = (req.body || {}) as { token?: string; password?: string }

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Chybí token pro obnovu hesla.' })
    return
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Heslo musí mít alespoň 8 znaků.' })
    return
  }

  const secret = process.env.JWT_SECRET as Secret | undefined
  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration' })
    return
  }

  try {
    const decoded = jwt.verify(token, secret) as any

    if (decoded?.type !== 'password-reset' || !decoded?.id) {
      res.status(400).json({ error: 'Neplatný token pro obnovu hesla.' })
      return
    }

    const userId = String(decoded.id)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(400).json({ error: 'Uživatel nenalezen.' })
      return
    }

    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })

    res.json({ ok: true, message: 'Heslo bylo úspěšně změněno.' })
  } catch (e: any) {
    if (e?.name === 'TokenExpiredError') {
      res.status(400).json({ error: 'Platnost odkazu již vypršela.' })
      return
    }
    console.error('POST /api/auth/reset-password error:', e)
    res.status(400).json({ error: 'Neplatný nebo poškozený token.' })
  }
})

export default router