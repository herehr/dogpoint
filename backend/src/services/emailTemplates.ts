// backend/src/services/emailTemplates.ts

type EmailLayoutArgs = {
  title: string
  introHtml: string
  buttonText?: string
  buttonUrl?: string
  footerNoteHtml?: string
  plainTextFallbackUrl?: string
}

const APP_DOMAIN_LABEL = 'patron.dog-point.cz'
const LOGO_URL = 'https://patron.dog-point.cz/logo1.png'

export function renderDogpointEmailLayout(args: EmailLayoutArgs): { html: string; text: string } {
  const {
    title,
    introHtml,
    buttonText,
    buttonUrl,
    footerNoteHtml,
    plainTextFallbackUrl,
  } = args

  const fallback = plainTextFallbackUrl || buttonUrl || ''

  const textLines: string[] = []
  textLines.push(`Dogpoint – ${title}`)
  textLines.push('')
  textLines.push(stripHtml(introHtml))
  textLines.push('')
  if (buttonUrl) {
    textLines.push(`${buttonText || 'Otevřít'}:`)
    textLines.push(buttonUrl)
    textLines.push('')
  }
  if (fallback) {
    textLines.push('Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:')
    textLines.push(fallback)
    textLines.push('')
  }
  if (footerNoteHtml) {
    textLines.push(stripHtml(footerNoteHtml))
    textLines.push('')
  }
  textLines.push('Kontakty')
  textLines.push('Telefon: +420 607 018 218')
  textLines.push('E-mail: info@dog-point.cz')
  textLines.push('Adresa útulku')
  textLines.push('Lhotky 60, 281 63 Malotice')
  textLines.push('Sídlo organizace a korespondenční kontakt')
  textLines.push('Dogpoint o.p.s., Milánská 452, 109 00 Praha 15')

  const text = textLines.join('\n')

  const html = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Dogpoint – ${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111;">
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
                      <img src="${LOGO_URL}" alt="Dogpoint" style="height:42px;display:block;border:0;outline:none;" />
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;color:#666;">
                      ${APP_DOMAIN_LABEL}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:800;">
                  ${escapeHtml(title)}
                </h1>

                <div style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#222;">
                  ${introHtml}
                </div>

                ${
                  buttonUrl
                    ? `
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
                  <tr>
                    <td align="center" bgcolor="#111111" style="border-radius:10px;">
                      <a href="${escapeAttr(buttonUrl)}"
                         style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                        ${escapeHtml(buttonText || 'Otevřít')}
                      </a>
                    </td>
                  </tr>
                </table>
                `
                    : ''
                }

                ${
                  fallback
                    ? `
                <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#666;">
                  Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:<br />
                  <a href="${escapeAttr(fallback)}" style="color:#111;word-break:break-all;">${escapeHtml(fallback)}</a>
                </p>
                `
                    : ''
                }

                ${
                  footerNoteHtml
                    ? `
                <div style="margin:16px 0 0;padding:12px 14px;background:#f3f4f6;border-radius:10px;font-size:13px;line-height:1.6;color:#111;">
                  ${footerNoteHtml}
                </div>
                `
                    : ''
                }
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

  return { html, text }
}

// ---- tiny helpers ----

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, '&#96;')
}