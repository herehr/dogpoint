// backend/src/services/notifyAdoptionStarted.ts
import { prisma } from '../prisma'
import { sendEmail as defaultSendEmail } from './email'

type Opts = {
  sendEmail?: boolean
  sendEmailFn?: (to: string, subject: string, html: string) => Promise<any>
}

export async function notifyAdoptionStarted(
  userId: string,
  animalId: string,
  opts: Opts = {}
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const animal = await prisma.animal.findUnique({ where: { id: animalId } })

  const animalName =
    (animal as any)?.jmeno ||
    (animal as any)?.name ||
    (animal as any)?.title ||
    'zvíře'

  // CLIENT REQUESTED TEXT
  const title = 'Děkujeme ti za adopci na dálku ❤️'
  const message = `${animalName} ti moc děkuje za podporu a těší se na společné novinky.`

  // ✅ Idempotent: don’t create duplicates
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      animalId,
      type: 'ADOPTION_STARTED' as any,
    } as any,
    select: { id: true },
  })

  if (!existing) {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        animalId,
        type: 'ADOPTION_STARTED' as any,
      } as any,
    })
  }

  // Optional welcome e-mail
// Optional welcome e-mail
if (opts.sendEmail && user?.email) {
  const send = opts.sendEmailFn ?? defaultSendEmail

  const subject = 'Děkujeme ti za adopci na dálku ❤️'

  const logoUrl = 'https://patron.dog-point.cz/logo1.png'
  const webUrl = 'https://patron.dog-point.cz'

  // If you have loginUrl/password available here, set them; otherwise keep just webUrl.
  // notifyAdoptionStarted currently does NOT receive password/loginUrl, so we keep it simple.
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;color:#111;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:720px;margin:0 auto;padding:28px 24px 40px 24px;">

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${logoUrl}" alt="DOGPOINT" style="height:36px;display:block;" />
      </div>
      <div style="text-align:right;">
        <a href="${webUrl}" style="color:#1a73e8;text-decoration:underline;font-size:16px;line-height:22px;">
          patron.dog-point.cz
        </a>
      </div>
    </div>

    <div style="height:46px;"></div>

    <!-- Title -->
    <div style="font-size:36px;line-height:1.1;font-weight:800;margin:0 0 14px 0;">
      Vítej v klubu, náš nový patrone ❤️
    </div>

    <!-- Main text -->
    <div style="font-size:20px;line-height:1.6;margin:0 0 12px 0;color:#111;">
      <b>${animalName}</b> ti moc děkuje za podporu a těší se, až s tebou bude sdílet novinky ze svého útulkového života.
    </div>

    <div style="font-size:18px;line-height:1.65;margin:0 0 18px 0;color:#555;">
      Vždy, když se u něj něco semele, přijde ti upozornění na e-mail.
    </div>

    <!-- Important box -->
    <div style="background:#f6f8ff;border:1px solid #d9e2ff;border-radius:16px;padding:16px 16px;margin:18px 0 18px 0;">
      <div style="font-size:18px;line-height:1.65;color:#111;margin:0;">
        <b>Důležité:</b> Pokud podporuješ adopci přes bankovní převod, po naskenování QR kódu prosím v bankovní aplikaci nastav
        <b>trvalý příkaz 1× měsíčně</b> (měsíční platbu).
      </div>
    </div>

    <!-- CTA -->
    <div style="margin:18px 0 18px 0;">
      <a href="${webUrl}"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                padding:16px 24px;border-radius:14px;font-size:18px;font-weight:700;">
        Otevřít účet patrona
      </a>
    </div>

    <!-- Friendly close -->
    <div style="font-size:18px;line-height:1.65;margin:10px 0 0 0;color:#555;">
      Jsme šťastní, že jsi s námi. Posíláme pac a pusu.
    </div>
    <div style="font-size:18px;line-height:1.65;margin:10px 0 18px 0;color:#111;">
      <b>Tým z Dogpointu ❤️</b>
    </div>

    <!-- Footer like screenshot -->
    <div style="border-top:1px solid #eee;padding-top:18px;">
      <div style="font-size:18px;line-height:1.6;color:#555;margin:0 0 6px 0;">
        S pozdravem
      </div>
      <div style="font-size:20px;line-height:1.6;margin:0 0 16px 0;">
        <b>tým DOG-POINT</b>
      </div>

      <div style="font-size:20px;line-height:1.6;margin:0 0 10px 0;"><b>Kontakty</b></div>
      <div style="font-size:18px;line-height:1.6;color:#555;margin:0;">
        Telefon: +420 607 018 218<br/>
        E-mail: <a href="mailto:info@dog-point.cz" style="color:#111;text-decoration:underline;">info@dog-point.cz</a>
      </div>

      <div style="height:16px;"></div>

      <div style="font-size:20px;line-height:1.6;margin:0 0 10px 0;"><b>Adresa útulku</b></div>
      <div style="font-size:18px;line-height:1.6;color:#555;margin:0;">
        Lhotky 60, 281 63 Malotice
      </div>

      <div style="height:16px;"></div>

      <div style="font-size:20px;line-height:1.6;margin:0 0 10px 0;"><b>Sídlo organizace a korespondenční kontakt</b></div>
      <div style="font-size:18px;line-height:1.6;color:#555;margin:0;">
        Dogpoint o.p.s., Milánská 452, 109 00 Praha 15
      </div>

      <div style="height:18px;"></div>

      <div style="font-size:14px;line-height:1.6;color:#888;margin:0;">
        Tento e-mail byl odeslán automaticky. Prosím neodpovídejte na něj.
      </div>
    </div>

  </div>
</body>
</html>
  `.trim()

  await send(user.email, subject, html)
}
}