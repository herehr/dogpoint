// backend/src/services/notifyAnimalUpdated.ts
import { prisma } from '../prisma'
import { sendEmailSafe } from './email'
import { renderDogpointEmailLayout } from './emailTemplates'

type SendEmailFn = (args: { to: string; subject: string; html: string; text?: string }) => Promise<void>

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: SendEmailFn
}

function appBase(): string {
  return (process.env.APP_BASE_URL || 'https://patron.dog-point.cz').replace(/\/+$/, '')
}

function escapeInline(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function notifyAnimalUpdated(animalId: string, opts: Opts = {}) {
  const sendEmail = Boolean(opts.sendEmail)
  const send = opts.sendEmailFn ?? sendEmailSafe

  // IMPORTANT: do NOT use select { jmeno, name } because schema may vary
  const animal = (await (prisma as any).animal.findUnique({
    where: { id: animalId },
  })) as any

  const animalName = animal?.jmeno || animal?.name || animal?.title || animal?.nazev || 'zvíře'

  // recipients = users with ACTIVE subscriptions to this animal
  const subs = (await (prisma as any).subscription.findMany({
    where: { animalId, status: 'ACTIVE' },
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  })) as Array<{ userId: string; user?: { email?: string | null } }>

  // Client requested wording:
  // Subject: "Upravili jsme profil tvého pejska"
  // Body: "Ahoj patrone! Profil tvého pejska jménem (jméno psa) prošel úpravou. Klikni a podívej se, co se u něj změnilo.
  //        Pac a pusu posílá tým z Dogpointu"
  const title = 'Upravili jsme profil tvého pejska'
  const message = `Profil tvého pejska jménem "${animalName}" prošel úpravou.`

  if (!subs?.length) {
    console.log('[notifyAnimalUpdated] no recipients', { animalId })
    return { recipients: 0, emailed: 0 }
  }

  // create in-app notifications (best-effort; must never break updates)
  for (const s of subs) {
    try {
      await (prisma as any).notification.create({
        data: {
          userId: s.userId,
          type: 'ANIMAL_UPDATED',
          title: 'Upravili jsme profil tvého pejska',
          message: `Profil tvého pejska jménem "${animalName}" prošel úpravou.`,
          animalId,
          postId: null,
        },
      })
    } catch (e) {
      console.warn('[notifyAnimalUpdated] notification create failed', e)
    }
  }

  // optional emails (unified layout)
  let emailed = 0
  if (sendEmail) {
    const url = `${appBase()}/zvirata/${encodeURIComponent(animalId)}`
    const subject = `Upravili jsme profil tvého pejska`

    const introHtml = `
      Ahoj patrone!<br/>
      Profil tvého pejska jménem <strong>${escapeInline(animalName)}</strong> prošel úpravou.
      Klikni a podívej se, co se u něj změnilo.
    `.trim()

    const { html, text } = renderDogpointEmailLayout({
      title: 'Upravili jsme profil tvého pejska',
      introHtml,
      buttonText: 'Klikni a podívej se',
      buttonUrl: url,
      plainTextFallbackUrl: url,
      footerNoteHtml: `
        Pac a pusu posílá<br/>
        <strong>tým z Dogpointu</strong><br/><br/>
        <strong>Bezpečnostní upozornění:</strong> Dogpoint po vás nikdy nebude chtít heslo e-mailem ani telefonicky.
      `.trim(),
    })

    for (const s of subs) {
      const email = s?.user?.email
      if (!email) continue
      try {
        await send({ to: email, subject, html, text })
        emailed += 1
      } catch (e) {
        console.warn('[notifyAnimalUpdated] email failed', { to: email })
      }
    }
  }

  return { recipients: subs.length, emailed }
}