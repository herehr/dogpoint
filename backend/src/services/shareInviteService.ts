// backend/src/services/shareInviteService.ts
import { randomBytes } from 'crypto'
import { prisma } from '../prisma'
import { Prisma, ShareInviteStatus, SubscriptionStatus } from '@prisma/client'
import { sendEmailSafe } from './email'
import { renderDogpointEmailLayout } from './emailTemplates'
import {
  canonicalEmailForInviteMatch,
  emailsMatchForInvite,
  normEmail,
} from '../utils/emailInviteMatch'

const APP_BASE = (process.env.APP_BASE_URL || process.env.FRONTEND_BASE_URL || 'https://patron.dog-point.cz').replace(
  /\/+$/,
  ''
)

const EXPIRY_DAYS = Math.min(30, Math.max(1, Number(process.env.SHARE_INVITE_EXPIRY_DAYS || 7)))
const MAX_MESSAGE = 300

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function newToken(): string {
  return randomBytes(32).toString('hex')
}

/** Missing ShareInvite table / migration not applied, or other DB errors we surface to the client. */
function mapPrismaShareInviteDbError(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2021') {
      return 'Funkce pozvánek není v databázi aktivní. Spusťte migrace (tabulka ShareInvite) nebo kontaktujte správce.'
    }
    if (e.code === 'P2002') {
      return 'Konflikt záznamu při vytváření pozvánky. Zkuste to prosím znovu.'
    }
  }
  const msg = String((e as { message?: string })?.message || e)
  if (/ShareInvite/i.test(msg) && /does not exist/i.test(msg)) {
    return 'Funkce pozvánek není v databázi aktivní. Spusťte migrace nebo kontaktujte správce.'
  }
  return null
}

/** Pending invites for this person (Gmail dot/plus aliases match DB). */
async function findPendingShareInvitesForEmail(rawEmail: string) {
  const emailNorm = normEmail(rawEmail)
  const canon = canonicalEmailForInviteMatch(rawEmail)
  const keys = [...new Set([emailNorm, canon])].filter(Boolean)

  let invites = await prisma.shareInvite.findMany({
    where: {
      recipientEmail: { in: keys },
      status: ShareInviteStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    include: { subscription: true },
  })
  invites = invites.filter((inv) => emailsMatchForInvite(inv.recipientEmail, rawEmail))
  if (invites.length > 0) return invites

  if (!emailNorm.endsWith('@gmail.com') && !emailNorm.endsWith('@googlemail.com')) return []

  const gmailPending = await prisma.shareInvite.findMany({
    where: {
      status: ShareInviteStatus.PENDING,
      expiresAt: { gt: new Date() },
      OR: [
        { recipientEmail: { endsWith: '@gmail.com' } },
        { recipientEmail: { endsWith: '@googlemail.com' } },
      ],
    },
    include: { subscription: true },
  })
  return gmailPending.filter((inv) => emailsMatchForInvite(inv.recipientEmail, rawEmail))
}

export async function expireIfNeeded(invite: { id: string; status: ShareInviteStatus; expiresAt: Date }) {
  if (invite.status !== ShareInviteStatus.PENDING) return invite
  if (invite.expiresAt.getTime() > Date.now()) return invite
  await prisma.shareInvite.update({
    where: { id: invite.id },
    data: { status: ShareInviteStatus.EXPIRED },
  })
  return { ...invite, status: ShareInviteStatus.EXPIRED }
}

export async function createShareInvite(params: {
  senderId: string
  subscriptionId: string
  recipientEmail: string
  message?: string | null
  reason?: string | null
}): Promise<{ ok: true; id: string; token: string; expiresAt: string } | { ok: false; error: string; status?: number }> {
  const rawTrimmed = String(params.recipientEmail || '').trim()
  if (!rawTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(rawTrimmed))) {
    return { ok: false, error: 'Neplatný e-mail', status: 400 }
  }
  /** Stored form so Gmail variants (dots/+) resolve to one row */
  const recipientEmail = canonicalEmailForInviteMatch(rawTrimmed)

  let message = params.message?.trim() || null
  if (message && message.length > MAX_MESSAGE) {
    return { ok: false, error: `Zpráva max. ${MAX_MESSAGE} znaků`, status: 400 }
  }
  const reason = params.reason?.trim()?.slice(0, 200) || null

  const sub = await prisma.subscription.findFirst({
    where: {
      id: params.subscriptionId,
      userId: params.senderId,
      status: SubscriptionStatus.ACTIVE,
    },
    include: {
      animal: { select: { id: true, jmeno: true, name: true, main: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  })
  if (!sub) {
    return { ok: false, error: 'Adopce nenalezena nebo není aktivní', status: 404 }
  }

  const senderUser = await prisma.user.findUnique({
    where: { id: params.senderId },
    select: { email: true },
  })
  if (emailsMatchForInvite(senderUser?.email || '', rawTrimmed)) {
    return { ok: false, error: 'Nemůžete pozvat sám sebe', status: 400 }
  }

  const giftCount = await prisma.subscriptionGiftRecipient.count({ where: { subscriptionId: sub.id } })
  if (giftCount >= 5) {
    return { ok: false, error: 'Maximálně 5 sdílených přístupů na adopci', status: 400 }
  }

  const existingGifts = await prisma.subscriptionGiftRecipient.findMany({
    where: { subscriptionId: sub.id },
  })
  if (existingGifts.some((g) => emailsMatchForInvite(g.email, rawTrimmed))) {
    return {
      ok: false,
      error:
        'Tento e-mail už k této adopci patří (je v seznamu obdarovaných nebo už pozvánku přijal). Další pozvánku nepotřebuje.',
      status: 400,
    }
  }

  let pendingList: Awaited<ReturnType<typeof prisma.shareInvite.findMany>>
  try {
    pendingList = await prisma.shareInvite.findMany({
      where: {
        subscriptionId: sub.id,
        status: ShareInviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    })
  } catch (e: unknown) {
    const mapped = mapPrismaShareInviteDbError(e)
    if (mapped) return { ok: false, error: mapped, status: 503 }
    throw e
  }
  if (pendingList.some((p) => emailsMatchForInvite(p.recipientEmail, rawTrimmed))) {
    return { ok: false, error: 'Aktivní pozvánka pro tento e-mail již existuje', status: 400 }
  }

  const token = newToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS)

  const animalName = sub.animal?.jmeno || sub.animal?.name || 'zvíře'
  const senderName =
    [sub.user?.firstName, sub.user?.lastName].filter(Boolean).join(' ').trim() ||
    sub.user?.email?.split('@')[0] ||
    'Dárce'
  const acceptUrl = `${APP_BASE}/invite/${token}`
  const img = sub.animal?.main
    ? `<p style="margin:16px 0;"><img src="${escapeHtml(sub.animal.main)}" alt="" style="max-width:100%;border-radius:12px;max-height:220px;object-fit:cover;" /></p>`
    : ''

  let introHtml = `<p><strong>${escapeHtml(senderName)}</strong> vás zve ke sledování adopce zvířete <strong>${escapeHtml(animalName)}</strong> na Dogpointu.</p>`
  if (message) {
    introHtml += `<p style="background:#f6f7fb;padding:12px 14px;border-radius:10px;border-left:4px solid #635BFF;">${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`
  }
  if (reason) {
    introHtml += `<p style="color:#555;font-size:14px;">${escapeHtml(reason)}</p>`
  }
  introHtml += img
  introHtml += `<p>Přijměte pozvánku a po přihlášení uvidíte příspěvky adoptovaného zvířete.</p>`

  const { html, text } = renderDogpointEmailLayout({
    title: `Pozvánka – ${animalName}`,
    introHtml,
    buttonText: 'Přijmout sdílení',
    buttonUrl: acceptUrl,
    plainTextFallbackUrl: acceptUrl,
    footerNoteHtml: 'Platnost pozvánky končí ' + expiresAt.toLocaleDateString('cs-CZ') + '.',
  })

  let invite: Awaited<ReturnType<typeof prisma.shareInvite.create>>
  try {
    invite = await prisma.shareInvite.create({
      data: {
        senderId: params.senderId,
        subscriptionId: sub.id,
        animalId: sub.animalId,
        recipientEmail,
        message,
        reason,
        token,
        expiresAt,
        status: ShareInviteStatus.PENDING,
      },
    })
  } catch (e: unknown) {
    const mapped = mapPrismaShareInviteDbError(e)
    if (mapped) return { ok: false, error: mapped, status: 503 }
    throw e
  }

  sendEmailSafe({
    to: normEmail(rawTrimmed),
    subject: `Dogpoint – pozvánka ke sdílení adopce (${animalName})`,
    html,
    text,
  }).catch((e: any) => console.warn('[shareInvite] email failed:', e?.message))

  return { ok: true, id: invite.id, token: invite.token, expiresAt: invite.expiresAt.toISOString() }
}

export async function previewShareInvite(token: string) {
  const t = String(token || '').trim()
  if (!t || t.length < 16) {
    return { ok: false as const, error: 'Neplatný odkaz' }
  }

  const inv = await prisma.shareInvite.findUnique({
    where: { token: t },
    include: {
      animal: { select: { jmeno: true, name: true, main: true } },
      sender: { select: { firstName: true, lastName: true, email: true } },
      subscription: { select: { status: true } },
    },
  })
  if (!inv) {
    return { ok: false as const, error: 'Pozvánka nenalezena' }
  }

  const updated = await expireIfNeeded(inv)
  if (updated.status === ShareInviteStatus.EXPIRED) {
    return { ok: true as const, status: 'EXPIRED' as const }
  }
  if (updated.status === ShareInviteStatus.DECLINED) {
    return { ok: true as const, status: 'DECLINED' as const }
  }
  if (updated.status === ShareInviteStatus.ACCEPTED) {
    return { ok: true as const, status: 'ACCEPTED' as const }
  }

  if (inv.subscription.status !== SubscriptionStatus.ACTIVE) {
    return { ok: true as const, status: 'DONOR_INACTIVE' as const }
  }

  const animalName = inv.animal?.jmeno || inv.animal?.name || 'Zvíře'
  const senderName =
    [inv.sender.firstName, inv.sender.lastName].filter(Boolean).join(' ').trim() ||
    inv.sender.email?.split('@')[0] ||
    'Dárce'

  return {
    ok: true as const,
    status: 'PENDING' as const,
    animalName,
    animalMain: inv.animal?.main || null,
    senderName,
    message: inv.message || null,
    reason: inv.reason || null,
    recipientEmail: inv.recipientEmail,
    expiresAt: inv.expiresAt.toISOString(),
  }
}

export async function acceptShareInvite(token: string, userId: string, userEmail: string) {
  const t = String(token || '').trim()
  if (!t) return { ok: false as const, error: 'Chybí token', status: 400 }

  const inv = await prisma.shareInvite.findUnique({
    where: { token: t },
    include: { subscription: true },
  })
  if (!inv) return { ok: false as const, error: 'Pozvánka nenalezena', status: 404 }

  const updated = await expireIfNeeded(inv)
  if (updated.status === ShareInviteStatus.EXPIRED) {
    return { ok: false as const, error: 'Pozvánka vypršela', status: 410 }
  }
  if (updated.status === ShareInviteStatus.DECLINED) {
    return { ok: false as const, error: 'Pozvánka byla odmítnuta', status: 410 }
  }
  if (updated.status === ShareInviteStatus.ACCEPTED) {
    return { ok: true as const, alreadyAccepted: true as const }
  }

  if (inv.subscription.status !== SubscriptionStatus.ACTIVE) {
    return { ok: false as const, error: 'Předplatné dárce již není aktivní', status: 403 }
  }

  if (!emailsMatchForInvite(userEmail, inv.recipientEmail)) {
    return {
      ok: false as const,
      error: 'Přihlaste se e-mailem, na který byla pozvánka odeslána.',
      status: 403,
      expectedEmailDomain: inv.recipientEmail.split('@')[1] || undefined,
    }
  }

  const giftCount = await prisma.subscriptionGiftRecipient.count({
    where: { subscriptionId: inv.subscriptionId },
  })
  if (giftCount >= 5) {
    return { ok: false as const, error: 'Kapacita sdílení pro tuto adopci je naplněna', status: 400 }
  }

  await prisma.$transaction([
    prisma.subscriptionGiftRecipient.upsert({
      where: {
        subscriptionId_email: {
          subscriptionId: inv.subscriptionId,
          email: canonicalEmailForInviteMatch(inv.recipientEmail),
        },
      },
      create: {
        subscriptionId: inv.subscriptionId,
        email: canonicalEmailForInviteMatch(inv.recipientEmail),
        userId,
      },
      update: { userId },
    }),
    prisma.shareInvite.update({
      where: { id: inv.id },
      data: { status: ShareInviteStatus.ACCEPTED, acceptedAt: new Date() },
    }),
  ])

  return { ok: true as const }
}

/**
 * After login / registration with email+password: grant access for all valid pending invites
 * sent to this address (donor subscription must still be ACTIVE).
 */
export async function acceptPendingShareInvitesForUser(userId: string, rawEmail: string): Promise<number> {
  const emailNorm = normEmail(rawEmail)
  if (!emailNorm) return 0

  const invites = await findPendingShareInvitesForEmail(rawEmail)

  let accepted = 0
  for (const inv of invites) {
    const updated = await expireIfNeeded(inv)
    if (updated.status !== ShareInviteStatus.PENDING) continue

    if (inv.subscription.status !== SubscriptionStatus.ACTIVE) continue

    const giftCount = await prisma.subscriptionGiftRecipient.count({
      where: { subscriptionId: inv.subscriptionId },
    })
    if (giftCount >= 5) continue

    try {
      const giftEmail = canonicalEmailForInviteMatch(inv.recipientEmail)
      await prisma.$transaction([
        prisma.subscriptionGiftRecipient.upsert({
          where: {
            subscriptionId_email: { subscriptionId: inv.subscriptionId, email: giftEmail },
          },
          create: {
            subscriptionId: inv.subscriptionId,
            email: giftEmail,
            userId,
          },
          update: { userId },
        }),
        prisma.shareInvite.update({
          where: { id: inv.id },
          data: { status: ShareInviteStatus.ACCEPTED, acceptedAt: new Date() },
        }),
      ])
      accepted++
    } catch (e: any) {
      console.warn('[acceptPendingShareInvitesForUser] invite', inv.id, e?.message || e)
    }
  }
  return accepted
}

export async function declineShareInvite(token: string) {
  const t = String(token || '').trim()
  if (!t) return { ok: false as const, error: 'Chybí token', status: 400 }

  const inv = await prisma.shareInvite.findUnique({ where: { token: t } })
  if (!inv) return { ok: false as const, error: 'Pozvánka nenalezena', status: 404 }

  const updated = await expireIfNeeded(inv)
  if (updated.status === ShareInviteStatus.EXPIRED) {
    return { ok: false as const, error: 'Pozvánka již vypršela', status: 410 }
  }
  if (updated.status !== ShareInviteStatus.PENDING) {
    return { ok: false as const, error: 'Pozvánka nelze odmítnout', status: 400 }
  }

  await prisma.shareInvite.update({
    where: { id: inv.id },
    data: { status: ShareInviteStatus.DECLINED },
  })
  return { ok: true as const }
}
