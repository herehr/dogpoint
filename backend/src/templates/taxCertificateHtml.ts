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
 * - Payments printed in ONE LINE: "d.m.yyyy: 100 Kč; d.m.yyyy: 200 Kč; ..."
 * - Intro line uses NAME + (tax) ADDRESS, never email
 * - Dates WITHOUT leading zeros (1.1.2025 instead of 01.01.2025)
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
  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    (doBase ? withVersionForSpaceAsset(`${doBase}/assets/dogpoint-logo.png`) : '') ||
    'https://dog-point.cz/wp-content/uploads/2023/01/dogpoint-logo.png'

  // ✅ Signature (optional)
  const signatureUrl =
    process.env.SIGNATURE_IMG_URL ||
    (doBase ? withVersionForSpaceAsset(`${doBase}/assets/michaela_podpis.png`) : '') ||
    ''

  // ✅ CZ date without leading zeros: 1.1.2025 (not 01.01.2025)
  const fmtDateCz = (d: Date | string) => {
    const dt = typeof d === 'string' ? new Date(d) : d
    if (Number.isNaN(dt.getTime())) return String(d)
    const dd = String(dt.getDate()) // <-- no padStart
    const mm = String(dt.getMonth() + 1) // <-- no padStart
    const yyyy = String(dt.getFullYear())
    return `${dd}.${mm}.${yyyy}`
  }

  const fmtCzk = (n: number | null | undefined) => {
    const v = Number(n ?? 0)
    return v.toLocaleString('cs-CZ').replace(/\u00A0/g, ' ')
  }

  // ============================================================
  // Recipient identity & address
  // Uses your Prisma schema:
  // - User has firstName/lastName/street/streetNo/zip/city
  // - TaxProfile can override both name + address and can be company
  // ============================================================
  const tp = ((recipient as any).taxProfile ?? null) as
    | null
    | {
        isCompany?: boolean
        companyName?: string | null
        taxId?: string | null
        firstName?: string | null
        lastName?: string | null
        street?: string | null
        streetNo?: string | null
        zip?: string | null
        city?: string | null
      }

  const userFirstName = String((recipient as any).firstName ?? '').trim()
  const userLastName = String((recipient as any).lastName ?? '').trim()
  const userTitle = String((recipient as any).title ?? '').trim()

  const userStreet = String((recipient as any).street ?? '').trim()
  const userStreetNo = String((recipient as any).streetNo ?? '').trim()
  const userZip = String((recipient as any).zip ?? '').trim()
  const userCity = String((recipient as any).city ?? '').trim()

  const taxIsCompany = Boolean(tp?.isCompany) || Boolean((recipient as any).isCompany)
  const taxCompanyName = String(
    tp?.companyName ?? (recipient as any).companyName ?? (recipient as any).name ?? ''
  ).trim()

  const taxFirstName = String(tp?.firstName ?? '').trim()
  const taxLastName = String(tp?.lastName ?? '').trim()

  const displayName = (() => {
    if (taxIsCompany) {
      return taxCompanyName || '—'
    }
    const personFromTax = [taxFirstName, taxLastName].filter(Boolean).join(' ').trim()
    if (personFromTax) return personFromTax
    const personFromUser = [userTitle, userFirstName, userLastName].filter(Boolean).join(' ').trim()
    return personFromUser || String((recipient as any).displayName ?? '').trim() || '—'
  })()

  const addrStreet = String(tp?.street ?? userStreet ?? '').trim()
  const addrStreetNo = String(tp?.streetNo ?? userStreetNo ?? '').trim()
  const addrZip = String(tp?.zip ?? userZip ?? '').trim()
  const addrCity = String(tp?.city ?? userCity ?? '').trim()

  const addressLine = [addrStreet, addrStreetNo].filter(Boolean).join(' ').trim()
  const zipCityLine = [addrZip, addrCity].filter(Boolean).join(' ').trim()
  const addressFull = [addressLine, zipCityLine].filter(Boolean).join(', ').trim()

  // Czech text: address label depends on company/person
  const addrLabel = taxIsCompany ? 'se sídlem' : 'bytem'

  // ============================================================
  // Payments / donation lines (robust parsing)
  // - Accepts various shapes: donations/items/payments/transactions/paymentLines
  // - Picks (date) from: date/paidAt/receivedAt/createdAt/...
  // - Picks (amount) from: amountCzk/amount/amountCZK/value/...
  // - Prints ONE LINE separated by "; "
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
        amountNum: a,
        amount: fmtCzk(a),
      }
    })
    .filter(Boolean) as Array<{ ts: number; date: string; amountNum: number; amount: string }>

  donationLines.sort((a, b) => a.ts - b.ts)

  const donationCount = donationLines.length
  const donationIntro = donationCount === 1 ? 'a to v tomto příspěvku:' : 'a to v těchto příspěvcích:'
  const issueDateStr = fmtDateCz(issueDate)

  // total: prefer provided totalCzk; otherwise compute from donationLines
  const providedTotal = Number((recipient as any).totalCzk ?? 0)
  const computedTotal = donationLines.reduce((sum, d) => sum + Number(d.amountNum || 0), 0)
  const totalCzk = providedTotal > 0 ? providedTotal : computedTotal

  // Signature sizing: 70% of original 75mm = 52.5mm
  const sigImgWidthMm = 52.5

  // Title position: ~5cm lower than before
  const titlePaddingTopMm = 68 // was 18mm; 18 + 50 = 68mm

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

    /* Stronger guard for Czech text blocks */
    .mainText, .intro, .legal, .donLine {
      word-break: keep-all !important;
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

    /* Title moved DOWN */
    .titleBlock {
      text-align: right;
      padding-top: ${titlePaddingTopMm}mm;
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

    .donLine {
      margin: 0;
      white-space: normal; /* allow wrapping on spaces/semicolons, not per-letter */
    }

    .legal {
      font-size: 10.5pt;
      line-height: 1.45;
      margin-top: 10mm;
    }

    /* Signature: ~5 lines below last text line */
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
        Kdyby naši psí svěřenci mohli podepisovat dokumenty, připojili by sem teď otisk tlapky.
        Ale tohle je potřeba udělat správně, oficiálně.
      </p>

      <div class="mainText">
        <div>
          Tímto potvrzujeme, že <strong>${escapeHtml(displayName)}</strong>${addressFull ? `, ${addrLabel} <strong>${escapeHtml(addressFull)}</strong>,` : ','}
          v roce ${year} podpořil / podpořila činnost obecně prospěšné společnosti Dogpoint, o. p. s.,
          celkovou částkou <strong>${fmtCzk(totalCzk)} Kč</strong>, ${donationIntro}
        </div>

        ${
          donationCount === 0
            ? `<div class="donationsOne">
                 <div style="margin-top:2mm;">V daném roce nebyly nalezeny žádné přijaté platby.</div>
               </div>`
            : `<div class="donationsOne">
                 <div class="donLine">
                   ${donationLines
                     .map((d) => `${escapeHtml(d.date)}: ${escapeHtml(d.amount)} Kč`)
                     .join('; ')}.
                 </div>
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