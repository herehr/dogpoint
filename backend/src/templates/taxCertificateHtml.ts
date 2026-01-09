// backend/src/templates/taxCertificateHtml.ts
import type { TaxRecipient } from '../services/taxQuery'

/**
 * Tax certificate HTML (ready for printing / PDF generation)
 * - all fonts in BLACK
 * - logo loaded via EMAIL_LOGO_URL (same as other e-mails), with fallbacks
 * - layout inspired by your screenshot (header, title, body, 3-column list, signature)
 */
export function renderTaxCertificateHtml(args: {
  year: number
  recipient: TaxRecipient
  issueDate?: Date
}) {
  const { year, recipient } = args
  const issueDate = args.issueDate ?? new Date()

  // ✅ Use the same logo approach as in e-mails:
  // Set in env: EMAIL_LOGO_URL=https://.../dogpoint-logo.png
  // Fallbacks:
  //  - DO_SPACE_PUBLIC_BASE + /assets/logo.png (or /logo.png)
  //  - hard fallback to dog-point.cz (you can replace)
  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    (process.env.DO_SPACE_PUBLIC_BASE
      ? `${process.env.DO_SPACE_PUBLIC_BASE.replace(/\/$/, '')}/assets/dogpoint-logo.png`
      : '') ||
    'https://dog-point.cz/wp-content/uploads/2023/01/dogpoint-logo.png'

  // Signature image (optional). If you want the Michaela block as image:
  // set env SIGNATURE_IMG_URL or use DO_SPACE_PUBLIC_BASE fallback.
  const signatureUrl =
    process.env.SIGNATURE_IMG_URL ||
    (process.env.DO_SPACE_PUBLIC_BASE
      ? `${process.env.DO_SPACE_PUBLIC_BASE.replace(/\/$/, '')}/assets/michaela_podpis.png`
      : '') ||
    ''

  const fmtDateCz = (d: Date | string) => {
    const dt = typeof d === 'string' ? new Date(d) : d
    if (Number.isNaN(dt.getTime())) return String(d)
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yyyy = String(dt.getFullYear())
    return `${dd}.${mm}.${yyyy}`
  }

  const fmtCzk = (n: number | null | undefined) => {
    const v = Number(n ?? 0)
    // Czech-ish formatting with spaces
    return v.toLocaleString('cs-CZ').replace(/\u00A0/g, ' ')
  }

  // --- Recipient fields (kept flexible, because your TaxRecipient may evolve) ---
  const fullName =
    (recipient as any).displayName ||
    [String((recipient as any).title ?? '').trim(), String((recipient as any).firstName ?? '').trim(), String((recipient as any).lastName ?? '').trim()]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    (recipient as any).name ||
    (recipient as any).email ||
    ''

  const name2 = String((recipient as any).name2 ?? '').trim()
  const namesLine = name2 ? `${fullName} / ${name2}` : fullName

  const street = String((recipient as any).street ?? '').trim()
  const streetNo = String((recipient as any).streetNo ?? (recipient as any).houseNo ?? '').trim()
  const zip = String((recipient as any).zip ?? '').trim()
  const city = String((recipient as any).city ?? '').trim()

  const addressLine = [street, streetNo].filter(Boolean).join(' ')
  const zipCityLine = [zip, city].filter(Boolean).join(' ')

  const totalCzk = Number((recipient as any).totalCzk ?? 0)

  // Donations list
  type DonationItem = { date?: string | Date; amountCzk?: number }
  const donations: DonationItem[] = Array.isArray((recipient as any).donations)
    ? ((recipient as any).donations as DonationItem[])
    : Array.isArray((recipient as any).items)
      ? ((recipient as any).items as DonationItem[])
      : []

  // Render up to 12 items into 3 columns x 4 rows (like screenshot)
  const donationLines = donations
    .filter((x) => x && (x.date || x.amountCzk != null))
    .slice(0, 12)
    .map((x) => ({
      date: x.date ? fmtDateCz(x.date) : '',
      amount: fmtCzk(Number(x.amountCzk ?? 0)),
    }))

  // Split into 3 columns
  const col1 = donationLines.slice(0, 4)
  const col2 = donationLines.slice(4, 8)
  const col3 = donationLines.slice(8, 12)

  // if no donations, still show 4 placeholder rows
  const ensure4 = (arr: { date: string; amount: string }[]) => {
    const out = [...arr]
    while (out.length < 4) out.push({ date: 'dd.mm.rrrr', amount: 'XY' })
    return out
  }

  const listCols = [ensure4(col1), ensure4(col2), ensure4(col3)]

  const issueDateStr = fmtDateCz(issueDate)

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>Potvrzení o bezúplatném plnění za rok ${year}</title>
  <style>
    /* Page setup for PDF printers */
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000; /* ✅ all fonts black */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      padding: 16mm 14mm 14mm 14mm;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* soft circles like screenshot (but keep text black) */
    .circle {
      position: absolute;
      border-radius: 9999px;
      background: rgba(173, 233, 233, 0.9);
      z-index: 0;
    }
    .c1 { width: 140mm; height: 140mm; left: -65mm; top: -55mm; }
    .c2 { width: 170mm; height: 170mm; right: -75mm; top: -50mm; }
    .c3 { width: 190mm; height: 190mm; left: -85mm; bottom: -95mm; }

    .content { position: relative; z-index: 1; }

    .header {
      display: grid;
      grid-template-columns: 62mm 1fr;
      column-gap: 10mm;
      align-items: start;
      margin-bottom: 10mm;
    }

    .logoRow {
      display: grid;
      grid-template-columns: 38mm 1fr;
      column-gap: 4mm;
      align-items: start;
    }

    .logo {
      width: 36mm;
      height: auto;
      display: block;
    }

    .addr {
      font-size: 9pt;
      line-height: 1.25;
      margin-top: 1mm;
      white-space: nowrap;
    }

    .titleBlock {
      text-align: right;
      padding-top: 2mm;
    }
    .title1 {
      font-size: 34pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .title2 {
      font-size: 16pt;
      font-weight: 800;
      margin: 2mm 0 0 0;
    }
    .subtitle {
      font-size: 12pt;
      margin: 2mm 0 0 0;
    }

    .intro {
      font-size: 11pt;
      margin: 2mm 0 8mm 0;
    }

    .mainText {
      font-size: 11pt;
      line-height: 1.45;
      margin-top: 2mm;
    }

    .donationsGrid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 10mm;
      margin-top: 6mm;
      margin-bottom: 10mm;
    }

    .donCol {
      font-size: 11pt;
      line-height: 1.6;
    }

    .legal {
      font-size: 10.5pt;
      line-height: 1.45;
      margin-top: 10mm;
    }

    .signature {
      position: absolute;
      right: 14mm;
      bottom: 14mm;
      width: 75mm;
      text-align: right;
    }
    .sigImg {
      width: 75mm;
      height: auto;
      display: ${signatureUrl ? 'block' : 'none'};
      margin-left: auto;
    }
    .sigFallback {
      display: ${signatureUrl ? 'none' : 'block'};
      font-size: 11pt;
      font-weight: 700;
      margin-top: 10mm;
    }

    /* small helper */
    .nowrap { white-space: nowrap; }
  </style>
</head>
<body>
  <div class="page">
    <div class="circle c1"></div>
    <div class="circle c2"></div>
    <div class="circle c3"></div>

    <div class="content">
      <div class="header">
        <div class="logoRow">
          <img class="logo" src="${logoUrl}" alt="Dogpoint logo" />
          <div class="addr">
            Milánská 452 | Praha 15 | 109 00<br/>
            Útulek: Lhotky 60 | Malotice | 281 63<br/>
            Účet: <span class="nowrap">2201505311/2010</span><br/>
            Infolinka: 296 330 541<br/>
            E-mail: darce@dog-point.cz<br/>
            www.dog-point.cz
          </div>
        </div>

        <div class="titleBlock">
          <p class="title1">POTVRZENÍ</p>
          <p class="title2">O BEZÚPLATNÉM PLNĚNÍ ZA ROK ${year}</p>
          <p class="subtitle">poskytnutém obecně prospěšné společnosti Dogpoint, o. p. s.</p>
        </div>
      </div>

      <p class="intro">
        Kdybyste si svěřenci mohli podepisovat dokumenty, připojil by sem teď otisk tlapky.
        Ale tohle je potřeba udělat správně, oficiálně.
      </p>

      <div class="mainText">
        <div>
          Tímto potvrzujeme, že <strong>${escapeHtml(namesLine)}</strong>${addressLine || zipCityLine ? ',' : ''}
          ${addressLine ? ` bytem nebo sídlem <strong>${escapeHtml(addressLine)}</strong>` : ''}
          ${zipCityLine ? `, <strong>${escapeHtml(zipCityLine)}</strong>` : ''},
          v roce ${year} podpořil / podpořila činnost obecně prospěšné společnosti Dogpoint, o. p. s.,
          celkovou částkou <strong>${fmtCzk(totalCzk)} Kč</strong>, a to v těchto příspěvcích:
        </div>

        <div class="donationsGrid">
          ${listCols
            .map(
              (col) => `
            <div class="donCol">
              ${col
                .map((d) => `dne ${escapeHtml(d.date)}. částkou ${escapeHtml(d.amount)} Kč,`)
                .join('<br/>')}
            </div>
          `,
            )
            .join('')}
        </div>

        <div class="legal">
          Příspěvky dorazily na účet číslo <strong>2201505311/2010</strong> patřící Dogpoint, o. p. s.
          Dárkyně / dárce si může hodnotu tohoto daru odečíst od základu daně podle podmínek
          § 15 odst. 1 nebo § 20 odst. 8 zákona č. 586/1992 Sb. o daních z příjmů ve znění pozdějších předpisů.
          Děkujeme za vaši štědrost.
          <br/><br/>
          Datum vystavení: <strong>${issueDateStr}</strong>
        </div>
      </div>

      <div class="signature">
        ${signatureUrl ? `<img class="sigImg" src="${signatureUrl}" alt="Podpis" />` : ''}
        ${signatureUrl ? '' : `<div class="sigFallback">Bc. Michaela Zemánková<br/><span style="font-weight:400;">ředitelka o. p. s.</span></div>`}
      </div>
    </div>
  </div>
</body>
</html>`
}

/**
 * Minimal HTML escaping for dynamic text fields.
 */
function escapeHtml(input: string) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}