// backend/src/templates/taxCertificateHtml.ts
import type { TaxRecipient } from '../services/taxQuery'

export function renderTaxCertificateHtml(args: {
  year: number
  recipient: TaxRecipient
  issueDate?: Date
}) {
  const { year, recipient } = args
  const issueDate = args.issueDate ?? new Date()

  // You said you already stored the HTML in backend/src/templates
  // → paste your final HTML here and interpolate values from recipient.
  // For now, minimal working example:

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Potvrzení o daru ${year}</title>
</head>
<body>
  <h1>Potvrzení o daru</h1>
  <p>Rok: <strong>${year}</strong></p>
  <p>E-mail: <strong>${recipient.email}</strong></p>
  <p>Celkem: <strong>${recipient.totalCzk} CZK</strong></p>
  <p>Datum vystavení: <strong>${issueDate.toISOString().slice(0, 10)}</strong></p>
</body>
</html>`
}