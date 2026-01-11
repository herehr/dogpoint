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
 * IMPORTANT (email reliability):
 * - Do NOT append ?v=... to EMAIL_LOGO_URL / SIGNATURE_IMG_URL (can be signed URLs)
 * - Cache-bust only our own public Space assets
 */

// Cache-busting for *our own public Space assets only*
// Change when you replace PNGs in Spaces/assets
const ASSET_VERSION = '2026-01-10'

function withVersionForSpaceAsset(url: string) {
  if (!url) return ''
  return url.includes('?')
    ? `${url}&v=${encodeURIComponent(ASSET_VERSION)}`
    : `${url}?v=${encodeURIComponent(ASSET_VERSION)}`
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

export function renderTaxCertificateHtml(args: {
  year: number
  recipient: TaxRecipient
  issueDate?: Date
}) {
  const { year, recipient } = args
  const issueDate = args.issueDate ?? new Date()

  const doBase = process.env.DO_SPACE_PUBLIC_BASE ? process.env.DO_SPACE_PUBLIC_BASE.replace(/\/$/, '') : ''

  // ✅ Logo
  // 1) EMAIL_LOGO_URL (as-is; could be signed!)
  // 2) DO_SPACE_PUBLIC_BASE/assets/dogpoint-logo.png (cache-busted)
  // 3) hard fallback
  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    (doBase ? withVersionForSpaceAsset(`${doBase}/assets/dogpoint-logo.png`) : '') ||
    'https://dog-point.cz/wp-content/uploads/2023/01/dogpoint-logo.png'

  // ✅ Signature (optional)
  // 1) SIGNATURE_IMG_URL (as-is; could be signed!)
  // 2) DO_SPACE_PUBLIC_BASE/assets/michaela_podpis.png (cache-busted)
  // 3) empty -> fallback text block
  const signatureUrl =
    process.env.SIGNATURE_IMG_URL ||
    (doBase ? withVersionForSpaceAsset(`${doBase}/assets/michaela_podpis.png`) : '') ||
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

  // ============================================================
  // Payments / donations list (robust)
  // We try multiple shapes (donations/items/payments/paymentLines)
  // and multiple possible field names for date+amount.
  // Output format requested: "dd.mm.yyyy: 100 Kč, ..."
  // ============================================================
  type AnyItem = Record<string, any>

  const candidateArrays: AnyItem[][] = []
  const pushIfArray = (v: any) => {
    if (Array.isArray(v)) candidateArrays.push(v as AnyItem[])
  }

  pushIfArray((recipient as any).donations)
  pushIfArray((recipient as any).items)
  pushIfArray((recipient as any).payments)
  pushIfArray((recipient as any).paymentLines)
  pushIfArray((recipient as any).transactions)

  const rawItems: AnyItem[] = candidateArrays.length ? candidateArrays.flat() : []

  const pickDate = (x: AnyItem): string | Date | null => {
    return (
      x?.date ||
      x?.paidAt ||
      x?.receivedAt ||
      x?.createdAt ||
      x?.created_at ||
      x?.paid_at ||
      x?.received_at ||
      x?.timestamp ||
      null
    )
  }

  const pickAmount = (x: AnyItem): number | null => {
    const v =
      x?.amountCzk ??
      x?.amountCZK ??
      x?.amount ??
      x?.czk ??
      x?.valueCzk ??
      x?.value ??
      x?.paidAmount ??
      x?.sum ??
      null
    if (v == null) return null
    const num = Number(v)
    return Number.isFinite(num) ? num : null
  }

  const donationLines = rawItems
    .map((x) => {
      const d = pickDate(x)
      const a = pickAmount(x)
      if (!d || a == null) return null
      const dt = new Date(d as any)
      const ts = !Number.isNaN(dt.getTime()) ? dt.getTime() : Number.POSITIVE_INFINITY
      return {
        ts,
        date: fmtDateCz(dt),
        amount: fmtCzk(a),
      }
    })
    .filter(Boolean) as Array<{ ts: number; date: string; amount: string }>
  donationLines.sort((a, b) => a.ts - b.ts)

  const donationCount = donationLines.length
  const donationIntro = donationCount === 1 ? 'a to v tomto příspěvku:' : 'a to v těchto příspěvcích:'
  const issueDateStr = fmtDateCz(issueDate)

  // Multi-column layout for many payments (still prints nicely)
  const columnCount = donationCount <= 8 ? 1 : donationCount <= 18 ? 2 : 3

  // For Czech text: address label depends on person/company
  const addrLabel = isCompany ? 'se sídlem' : 'bytem'

  // Signature sizing: 70% of original 75mm = 52.5mm
  const sigImgWidthMm = 52.5

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

    /* Title moved DOWN below the address block */
    .titleBlock {
      text-align: right;
      padding-top: 18mm;
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

    /* (1) Signature should be ~5 lines below the last text line */
    .signature {
      margin-top: 5.6em; /* ~5 lines spacing */
      text-align: right;
      width: 100%;
    }
    .sigImg {
      width: ${sigImgWidthMm}mm; /* 70% size */
      height: auto;
      display: ${signatureUrl ? 'inline-block' : 'none'};
    }
    .sigFallback {
      display: ${signatureUrl ? 'none' : 'inline-block'};
      font-size: 11pt;
      font-weight: 700;
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
            ? `<div class="donationsOne">
                 <div style="margin-top:2mm;">V daném roce nebyly nalezeny žádné přijaté platby.</div>
               </div>`
            : donationCount === 1
              ? `<div class="donationsOne">
                   <div class="donLine">${escapeHtml(donationLines[0].date)}: ${escapeHtml(
                   donationLines[0].amount,
                 )} Kč.</div>
                 </div>`
              : `<div class="donationsMulti">
                   ${donationLines
                     .map((d, idx) => {
                       const isLast = idx === donationLines.length - 1
                       return `<div class="donLine">${escapeHtml(d.date)}: ${escapeHtml(d.amount)} Kč${
                         isLast ? '.' : ','
                       }</div>`
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
  </div>
</body>
</html>`
}