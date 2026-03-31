/** Diacritic-insensitive search (cs), multi-word AND. */

export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function matchesSearch(haystack: string, query: string): boolean {
  const nq = normalizeForSearch(query.trim())
  if (!nq) return true
  const nt = normalizeForSearch(haystack)
  const words = nq.split(/\s+/).filter(Boolean)
  return words.every((w) => nt.includes(w))
}

export function rowMatchesSearch(row: Record<string, unknown>, query: string): boolean {
  if (!query.trim()) return true
  const parts: string[] = []
  for (const v of Object.values(row)) {
    if (v == null) continue
    if (typeof v === 'object' && v instanceof Date) {
      parts.push(v.toISOString())
      continue
    }
    if (typeof v === 'object') continue
    parts.push(String(v))
  }
  return matchesSearch(parts.join(' '), query)
}
