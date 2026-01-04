// backend/src/services/pdf.ts
import puppeteer, { Browser } from 'puppeteer-core'

/**
 * Convert HTML to PDF buffer using system Chromium (puppeteer-core).
 * Works in Docker + DigitalOcean App Platform.
 */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  let browser: Browser | null = null

  try {
    browser = await puppeteer.launch({
      // IMPORTANT: provided by Dockerfile
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,

      // Required for Docker / DO
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    })

    const page = await browser.newPage()

    // Use a predictable viewport
    await page.setViewport({ width: 1240, height: 1754 })

    // Load HTML
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
    })

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm',
      },
    })

    return Buffer.from(pdf)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}