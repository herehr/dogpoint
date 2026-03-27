// backend/src/services/notifyGiftRecipientsOnSubscriptionCanceled.ts
/**
 * When the subscriber cancels a subscription: notify all gift recipients (same day),
 * then remove their SubscriptionGiftRecipient rows and related ShareInvite rows.
 */
import { prisma } from '../prisma'
import { sendEmailSafe } from './email'
import { renderDogpointEmailLayout } from './emailTemplates'

const FRONTEND_BASE = (
  process.env.FRONTEND_BASE_URL ||
  process.env.APP_BASE_URL ||
  'https://patron.dog-point.cz'
).replace(/\/+$/, '')

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function donorLabel(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (name) return name
  return email?.split('@')[0] || 'Dárce'
}

/**
 * Call after the Subscription row is already updated to CANCELED.
 */
export async function notifyGiftRecipientsOnSubscriptionCanceled(subscriptionId: string): Promise<void> {
  const recipients = await prisma.subscriptionGiftRecipient.findMany({
    where: { subscriptionId },
    select: { id: true, email: true },
  })

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      animal: { select: { id: true, jmeno: true, name: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  if (!sub?.animal) {
    await prisma.subscriptionGiftRecipient.deleteMany({ where: { subscriptionId } })
    await prisma.shareInvite.deleteMany({ where: { subscriptionId } })
    return
  }

  const animalName = sub.animal.jmeno || sub.animal.name || 'zvíře'
  const animalId = sub.animal.id
  const donorName = donorLabel(sub.user?.firstName, sub.user?.lastName, sub.user?.email)
  const amount = Math.max(50, sub.monthlyAmount || 200)
  const supportUrl = `${FRONTEND_BASE}/adopce/${encodeURIComponent(animalId)}?amount=${encodeURIComponent(String(amount))}`

  const introHtml = `
    <p>Předplatitel <strong>${escapeHtml(donorName)}</strong> zrušil adopci zvířete <strong>${escapeHtml(animalName)}</strong>.</p>
    <p>Váš přístup byl svázán s jeho účtem – sdílení tímto končí stejně jako jeho předplatné.</p>
    <p>Pokud chcete zvíře i nadále podporovat, můžete si založit vlastní adopci (platební brána s předvyplněným zvířetem a částkou):</p>
  `

  const { html, text } = renderDogpointEmailLayout({
    title: `Konec sdílené adopce – ${animalName}`,
    introHtml,
    buttonText: 'Podpořit zvíře',
    buttonUrl: supportUrl,
    plainTextFallbackUrl: supportUrl,
    footerNoteHtml:
      'Tento e-mail jsme poslali, protože jste měli sdílený přístup k adopci zrušené předplatitelem.',
  })

  if (recipients.length > 0) {
    for (const gr of recipients) {
      const to = String(gr.email || '')
        .trim()
        .toLowerCase()
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) continue
      try {
        await sendEmailSafe({
          to,
          subject: `Dogpoint – předplatitel zrušil adopci (${animalName})`,
          html,
          text,
        })
      } catch (e: any) {
        console.warn('[notifyGiftRecipientsOnSubscriptionCanceled] email failed', to, e?.message || e)
      }
    }
  }

  await prisma.subscriptionGiftRecipient.deleteMany({ where: { subscriptionId } })
  await prisma.shareInvite.deleteMany({ where: { subscriptionId } })
}
