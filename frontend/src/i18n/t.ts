import { clientConfig as cfg } from '../config/clientConfig'
import cs from './messages/cs.json'
import de from './messages/de.json'

type Bundle = typeof cs

const bundles: Record<string, Bundle> = { cs, de }

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

/**
 * Localised UI string. Keys are dot paths, e.g. `header.subtitle`.
 * Falls back to Czech, then the key, for missing German strings.
 */
export function t(
  key: string,
  locale: 'cs' | 'de' = cfg.locale
): string {
  const loc = locale === 'de' ? 'de' : 'cs'
  const primary = getByPath(bundles[loc], key)
  if (primary) return primary
  const fallback = getByPath(bundles.cs, key)
  if (fallback) return fallback
  return key
}
