import DOMPurify from 'dompurify'

/**
 * Sanitize rich HTML before `dangerouslySetInnerHTML` (posts, notifications).
 * Strips script/on* handlers; allow typical content tags from the editor.
 */
export function sanitizeHtmlForDisplay(html: string | null | undefined): string {
  if (html == null || html === '') return ''
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(String(html), { USE_PROFILES: { html: true } })
}
