/**
 * Parse faq.md: # title, intro, ## sections with ### Q / answer blocks, optional links section.
 */

export type FaqItem = { id: string; question: string; answerMarkdown: string }

export type FaqSection =
  | { type: 'accordion'; title: string; items: FaqItem[] }
  | { type: 'markdown'; title: string; body: string }

export type ParsedFaq = {
  pageTitle: string
  introMarkdown: string
  sections: FaqSection[]
}

let idCounter = 0
function nextId() {
  idCounter += 1
  return `faq-${idCounter}`
}

export function parseFaqMarkdown(md: string): ParsedFaq {
  idCounter = 0
  const normalized = md.replace(/\r\n/g, '\n').trim()

  const h1 = normalized.match(/^#\s+(.+)$/m)
  const pageTitle = (h1?.[1] || 'FAQ').trim()

  const withoutH1 = normalized.replace(/^#\s+[^\n]+\n*/m, '').trim()

  const chunks = withoutH1.split(/\n(?=## )/)
  const first = (chunks.shift() || '').trim()
  const introMarkdown = first
    .replace(/^---\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const sections: FaqSection[] = []

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue

    const lines = trimmed.split('\n')
    const titleLine = lines[0]?.replace(/^##\s+/, '').trim() || ''
    const body = lines.slice(1).join('\n').trim()

    if (/^užitečné\s+odkazy$/i.test(titleLine)) {
      sections.push({ type: 'markdown', title: titleLine, body })
      continue
    }

    const qParts = body.split(/\n(?=### )/)
    const items: FaqItem[] = []

    for (const part of qParts) {
      const p = part.trim()
      if (!p) continue
      const m = p.match(/^###\s+([^\n]+)\n([\s\S]*)$/m)
      if (m) {
        items.push({
          id: nextId(),
          question: m[1].trim(),
          answerMarkdown: m[2].trim().replace(/^---\s*$/gm, '').trim(),
        })
      }
    }

    if (items.length > 0) {
      sections.push({ type: 'accordion', title: titleLine, items })
    }
  }

  return { pageTitle, introMarkdown, sections }
}
