type TaxRequestEmailParams = {
  link: string
  expiresDate: string
  recheck?: boolean
}

export function renderTaxRequestEmailHtml({
  link,
  expiresDate,
  recheck = false,
}: TaxRequestEmailParams): string {
  const introText = recheck
    ? 'prosíme o <strong>kontrolu</strong> (a případnou opravu) údajů pro vystavení <strong>potvrzení o daru</strong>.'
    : 'prosíme o <strong>doplnění</strong> údajů pro vystavení <strong>potvrzení o daru</strong>.'

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>Dogpoint – údaje pro potvrzení o daru</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          
          <!-- HEADER -->
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <table width="100%">
                <tr>
                  <td align="left">
                    <img src="https://patron.dog-point.cz/logo1.png" />
                         alt="Dogpoint"
                         height="32"
                         style="display:block;border:0;" />
                  </td>
                  <td align="right" style="font-size:13px;">
                    <a href="https://patron.dog-point.cz"
                       style="color:#2563eb;text-decoration:none;">
                      patron.dog-point.cz
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding:24px 28px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;">
                Údaje pro potvrzení o daru
              </h1>

              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">
                Dobrý den,
              </p>

              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;">
                ${introText}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td>
                    <a href="${link}"
                       style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">
                      Otevřít formulář
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#555;">
                Platnost odkazu do:
                <strong>${expiresDate}</strong>
              </p>

              <p style="margin:18px 0 0 0;font-size:13px;color:#555;">
                Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:<br/>
                <a href="${link}" style="color:#2563eb;word-break:break-all;">
                  ${link}
                </a>
              </p>
            </td>
          </tr>

          <!-- SECURITY -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="background:#f3f4f6;border-radius:8px;padding:14px;font-size:13px;color:#333;">
                <strong>Bezpečnostní upozornění:</strong>
                Dogpoint po vás nikdy nebude chtít heslo e-mailem ani telefonicky.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 28px;border-top:1px solid #e5e7eb;font-size:13px;color:#444;">
              <p style="margin:0 0 12px 0;">
                S pozdravem<br/>
                <strong>tým DOG-POINT</strong>
              </p>

              <p style="margin:0 0 8px 0;">
                <strong>Kontakty</strong><br/>
                Telefon: +420 607 018 218<br/>
                E-mail: <a href="mailto:info@dog-point.cz" style="color:#2563eb;">info@dog-point.cz</a>
              </p>

              <p style="margin:0 0 8px 0;">
                <strong>Adresa útulku</strong><br/>
                Lhotky 60, 281 63 Malotice
              </p>

              <p style="margin:0;">
                <strong>Sídlo organizace a korespondenční kontakt</strong><br/>
                Dogpoint o.p.s., Milánská 452, 109 00 Praha 15
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px;font-size:12px;color:#777;text-align:center;">
              Tento e-mail byl odeslán automaticky. Prosím neodpovídejte na něj.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}