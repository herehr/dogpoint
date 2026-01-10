// backend/src/templates/taxCertificateHtml.ts
import type { TaxRecipient } from '../services/taxQuery'

/**
 * Tax certificate HTML (ready for printing / PDF generation)
 * - all fonts in BLACK
 * - logo loaded via EMAIL_LOGO_URL (same as other e-mails), with fallbacks
 * - layout inspired by your screenshot (header, title, body, list, signature)
 *
 * FIXES:
 * - Prevent ugly word splitting (Infolink-a / E-m-ail / obecně→o becně …)
 * - Donation list shows ALL payments in the given year (incl. single payments)
 * - If only ONE payment: show only ONE line and use singular wording
 * - Intro line uses NAME + (tax) ADDRESS, never email
 *
 * NOTES (important for email sending):
 * - Keep URLs clean and robust (do NOT break env URLs)
 * - Add cache-busting for Space assets only (logo/signature filenames)
 */

// Change this value when you upload new PNGs to Spaces (cache bust)
const ASSET_VERSION = '2026-01-10'

function appendVersion(url: string, version: string) {
  if (!url) return ''
  // if url already has ?, append &v=..., otherwise ?v=...
  return url.includes('?') ? `${url}&v=${encodeURIComponent(version)}` : `${url}?v=${encodeURIComponent(version)}`
}

export function renderTaxCertificateHtml(args: {
  year: number
  recipient: TaxRecipient
  issueDate?: Date
}) {
  const { year, recipient } = args
  const issueDate = args.issueDate ?? new Date()

  // ✅ Base: if EMAIL_LOGO_URL is set, use it (and only add ?v=... safely)
  // Fallback: DO_SPACE_PUBLIC_BASE/assets/dogpoint-logo.png
  // Hard fallback: dog-point.cz wordpress image
  const logoUrl =
    (process.env.EMAIL_LOGO_URL ? appendVersion(process.env.EMAIL_LOGO_URL, ASSET_VERSION) : '') ||
    (process.env.DO_SPACE_PUBLIC_BASE
      ? appendVersion(
          `${process.env.DO_SPACE_PUBLIC_BASE.replace(/\/$/, '')}/assets/dogpoint-logo.png`,
          ASSET_VERSION,
        )
      : '') ||
    appendVersion('https://dog-point.cz/wp-content/uploads/2023/01/dogpoint-logo.png', ASSET_VERSION)

  // Signature image (optional)
  // If SIGNATURE_IMG_URL is set, use it (append version safely)
  // Else use Spaces asset (append version safely)
  const signatureUrl =
    (process.env.SIGNATURE_IMG_URL ? appendVersion(process.env.SIGNATURE_IMG_URL, ASSET_VERSION) : '') ||
    (process.env.DO_SPACE_PUBLIC_BASE
      ? appendVersion(
          `${process.env.DO_SPACE_PUBLIC_BASE.replace(/\/$/, '')}/assets/michaela_podpis.png`,
          ASSET_VERSION,
        )
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
    return v.toLocaleString('cs-CZ').replace(/\u00A0/g, ' ')
  }

  // --- Recipient identity (NEVER email) ---
  const isCompany =
    Boolean((recipient as any).isCompany) ||
    Boolean((recipient as any).companyName) ||
    Boolean((recipient as any).ico) ||
    Boolean((recipient as any).ic) ||
    Boolean((recipient as any).taxId)

  const firstName = String((recipient as any).firstName ?? '').trim()
  const lastName = String((recipient as any).lastName ?? '').trim()
  const title = String((recipient as any).title ?? '').trim()
  const companyName = String((recipient as any).companyName ?? (recipient as any).name ?? '').trim()

  const personName = [title, firstName, lastName].filter(Boolean).join(' ').trim()
  const displayName =
    (isCompany ? companyName : personName) ||
    String((recipient as any).displayName ?? '').trim() ||
    '—'

  // --- Address (prefer TAX address if available) ---
  const taxStreet = String((recipient as any).taxStreet ?? (recipient as any).tax_address_street ?? '').trim()
  const taxStreetNo = String((recipient as any).taxStreetNo ?? (recipient as any).tax_address_street_no ?? '').trim()
  const taxZip = String((recipient as any).taxZip ?? (recipient as any).tax_address_zip ?? '').trim()
  const taxCity = String((recipient as any).taxCity ?? (recipient as any).tax_address_city ?? '').trim()
  const taxCountry = String((recipient as any).taxCountry ?? (recipient as any).tax_address_country ?? '').trim()

  const street = String((recipient as any).street ?? '').trim()
  const streetNo = String((recipient as any).streetNo ?? (recipient as any).houseNo ?? '').trim()
  const zip = String((recipient as any).zip ?? '').trim()
  const city = String((recipient as any).city ?? '').trim()
  const country = String((recipient as any).country ?? '').trim()

  const hasTaxAddress = Boolean(taxStreet || taxZip || taxCity || taxCountry)

  const addrStreet = hasTaxAddress ? taxStreet : street
  const addrStreetNo = hasTaxAddress ? taxStreetNo : streetNo
  const addrZip = hasTaxAddress ? taxZip : zip
  const addrCity = hasTaxAddress ? taxCity : city
  const addrCountry = hasTaxAddress ? taxCountry : country

  const addressLine = [addrStreet, addrStreetNo].filter(Boolean).join(' ').trim()
  const zipCityLine = [addrZip, addrCity].filter(Boolean).join(' ').trim()
  const countryLine = addrCountry.trim()

  const addressFull = [addressLine, zipCityLine, countryLine].filter(Boolean).join(', ').trim()

  const totalCzk = Number((recipient as any).totalCzk ?? 0)

  // Donations list: show ALL in the year (incl. single payments)
  type DonationItem = { date?: string | Date; amountCzk?: number }
  const rawDonations: DonationItem[] = Array.isArray((recipient as any).donations)
    ? ((recipient as any).donations as DonationItem[])
    : Array.isArray((recipient as any).items)
      ? ((recipient as any).items as DonationItem[])
      : []

  const donationLines = rawDonations
    .filter((x) => x && (x.date || x.amountCzk != null))
    .map((x) => {
      const dt = x.date ? new Date(x.date as any) : null
      const ts = dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : Number.POSITIVE_INFINITY
      return {
        ts,
        date: x.date ? fmtDateCz(x.date) : '',
        amount: fmtCzk(Number(x.amountCzk ?? 0)),
      }
    })
    .sort((a, b) => a.ts - b.ts)

  const donationCount = donationLines.length
  const donationIntro = donationCount === 1 ? 'a to v tomto příspěvku:' : 'a to v těchto příspěvcích:'
  const issueDateStr = fmtDateCz(issueDate)

  // Multi-column layout for many payments (still prints nicely)
  const columnCount = donationCount <= 8 ? 1 : donationCount <= 18 ? 2 : 3

  // For Czech text: address label depends on person/company
  const addrLabel = isCompany ? 'se sídlem' : 'bytem'

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>Potvrzení o bezúplatném plnění za rok ${year}</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }

    /* IMPORTANT: prevent ugly word splitting in PDF renderers */
    * {
      box-sizing: border-box;
      hyphens: none !important;
      -webkit-hyphens: none !important;
      -ms-hyphens: none !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
    }

    body {
      font-family: Helvetica, Arial, sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      padding: 16mm 14mm 14mm 14mm;
      overflow: hidden;
    }

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
      grid-template-columns: 70mm 1fr;
      column-gap: 10mm;
      align-items: start;
      margin-bottom: 10mm;
    }

    .logoRow {
      display: grid;
      grid-template-columns: 38mm 1fr;
      column-gap: 4mm;
      align-items: start;
      min-width: 0;
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
      min-width: 0;
    }
    .contactRow{
      display: grid;
      grid-template-columns: 18mm 1fr;
      column-gap: 3mm;
      align-items: baseline;
      margin: 0.2mm 0;
      min-width: 0;
    }
    .contactLabel{
      white-space: nowrap;
      font-weight: 700;
    }
    .contactValue{
      white-space: nowrap;
      min-width: 0;
    }

    .titleBlock {
      text-align: right;
      padding-top: 2mm;
      min-width: 0;
    }
    .title1 {
      font-size: 34pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
      white-space: nowrap;
    }
    .title2 {
      font-size: 16pt;
      font-weight: 800;
      margin: 2mm 0 0 0;
      white-space: nowrap;
    }
    .subtitle {
      font-size: 12pt;
      margin: 2mm 0 0 0;
    }

    .intro {
      font-size: 11pt;
      margin: 2mm 0 8mm 0;
      line-height: 1.45;
    }

    .mainText {
      font-size: 11pt;
      line-height: 1.45;
      margin-top: 2mm;
    }

    .donationsOne {
      margin-top: 4mm;
      font-size: 11pt;
      line-height: 1.55;
    }

    .donationsMulti {
      margin-top: 4mm;
      column-count: ${columnCount};
      column-gap: 10mm;
      font-size: 11pt;
      line-height: 1.55;
    }

    .donLine {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      margin: 0 0 1.2mm 0;
      white-space: nowrap;
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
      line-height: 1.3;
    }

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
            <div class="contactRow"><div class="contactLabel">Adresa:</div><div class="contactValue">Milánská 452 | Praha 15 | 109 00</div></div>
            <div class="contactRow"><div class="contactLabel">Útulek:</div><div class="contactValue">Lhotky 60 | Malotice | 281 63</div></div>
            <div class="contactRow"><div class="contactLabel">Účet:</div><div class="contactValue"><span class="nowrap">2201505311/2010</span></div></div>
            <div class="contactRow"><div class="contactLabel">Infolinka:</div><div class="contactValue">296 330 541</div></div>
            <div class="contactRow"><div class="contactLabel">E-mail:</div><div class="contactValue">darce@dog-point.cz</div></div>
            <div class="contactRow"><div class="contactLabel">Web:</div><div class="contactValue">www.dog-point.cz</div></div>
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
          Tímto potvrzujeme, že <strong>${escapeHtml(displayName)}</strong>
          ${addressFull ? `, ${addrLabel} <strong>${escapeHtml(addressFull)}</strong>,` : ','}
          v roce ${year} podpořil / podpořila činnost obecně prospěšné společnosti Dogpoint, o. p. s.,
          celkovou částkou <strong>${fmtCzk(totalCzk)} Kč</strong>, ${donationIntro}
        </div>

        ${
          donationCount === 0
            ? `<div class="donationsOne"><span class="donLine">dne dd.mm.rrrr částkou XY Kč.</span></div>`
            : donationCount === 1
              ? `<div class="donationsOne">
                   <div class="donLine">dne ${escapeHtml(donationLines[0].date)} částkou ${escapeHtml(donationLines[0].amount)} Kč.</div>
                 </div>`
              : `<div class="donationsMulti">
                   ${donationLines
                     .map((d, idx) => {
                       const isLast = idx === donationLines.length - 1
                       return `<div class="donLine">dne ${escapeHtml(d.date)} částkou ${escapeHtml(d.amount)} Kč${isLast ? '.' : ','}</div>`
                     })
                     .join('')}
                 </div>`
        }

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
        ${
          signatureUrl
            ? ''
            : `<div class="sigFallback">Bc. Michaela Zemánková<br/><span style="font-weight:400;">ředitelka o. p. s.</span></div>`
        }
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