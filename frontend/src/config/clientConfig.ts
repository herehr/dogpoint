/**
 * White-label / multi-tenant branding (Vite: only VITE_* is exposed in the browser).
 * Defaults match the current Czech (Dogpoint) production site so existing deploys are unchanged
 * if you do not set these variables.
 */
function env(key: string, fallback: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key]
  return v != null && String(v).trim() !== '' ? String(v).trim() : fallback
}

function envBool(key: string, defaultTrue: boolean): boolean {
  const v = (import.meta.env as Record<string, string | undefined>)[key]
  if (v == null || v === '') return defaultTrue
  return String(v).toLowerCase() === 'true' || v === '1'
}

function envJSON<T>(key: string, fallback: T): T {
  const raw = (import.meta.env as Record<string, string | undefined>)[key]
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export type SocialLink = { label: string; href: string }

const rawLocale = env('VITE_LOCALE', 'cs')
const locale: 'cs' | 'de' = rawLocale === 'de' ? 'de' : 'cs'
const defaultHtmlLang = locale === 'de' ? 'de' : 'cs'

export const clientConfig = {
  appName: env('VITE_APP_NAME', 'Dogpoint'),
  appTitle: env('VITE_APP_TITLE', 'Dogpoint Adopce'),
  /** <html lang="…"> + i18n default */
  htmlLang: env('VITE_HTML_LANG', defaultHtmlLang),
  /** UI message bundle: cs | de */
  locale,

  supportEmail: env('VITE_SUPPORT_EMAIL', 'info@dog-point.cz'),
  supportPhone: env('VITE_SUPPORT_PHONE', '+420 607 018 218'),
  supportPhoneTel: env('VITE_SUPPORT_PHONE_TEL', '+420607018218'),

  legalImprintUrl: env('VITE_LEGAL_IMPRINT_URL', ''),
  legalPrivacyUrl: env('VITE_LEGAL_PRIVACY_URL', ''),

  /** Public logo (path under /public or absolute URL) */
  logoUrl: env('VITE_LOGO_URL', '/logo1.png'),

  /** MUI primary / secondary / brand.dark */
  primaryColor: env('VITE_PRIMARY_COLOR', '#00B3B8'),
  secondaryColor: env('VITE_SECONDARY_COLOR', '#00A0A6'),
  brandDark: env('VITE_BRAND_DARK', '#0F172A'),

  /**
   * Prefix for app-specific localStorage keys (new deployments may use e.g. `fh`).
   * Note: token keys in api.ts are still `accessToken` / `dp:token` fallbacks for migration —
   * only notification last-seen etc. use this first.
   */
  storagePrefix: env('VITE_STORAGE_PREFIX', 'dp'),

  features: {
    /** Admin → Statistiky: show FIO import block (hide for Stripe-only DE demos). Default true. */
    fioImportInAdmin: envBool('VITE_FIO_IMPORT_UI', true),
  },

  /**
   * Footer social links. Override with VITE_SOCIAL_LINKS_JSON='[{"label":"TikTok","href":"https://…"}]'
   * Empty array = section hidden or use defaults below.
   */
  socialLinks: envJSON<SocialLink[]>('VITE_SOCIAL_LINKS_JSON', [
    { label: 'TikTok', href: 'https://www.tiktok.com/@utulek_dogpoint' },
    { label: 'Instagram', href: 'https://www.instagram.com/utulek_dogpoint/?hl=cs' },
    { label: 'YouTube', href: 'https://www.youtube.com/@uTULEKdogpoint' },
  ]),

  /**
   * Google Analytics 4 measurement ID. If empty, gtag is not loaded (see main.tsx).
   * Existing CZ production: set VITE_GA_MEASUREMENT_ID=G-GT2K977M1R in the build environment.
   */
  gaMeasurementId: env('VITE_GA_MEASUREMENT_ID', ''),

  /**
   * Optional override for footer “org / legal” column (use \\n in .env for newlines, or set in i18n JSON).
   * If non-empty, replaces default block from i18n for that column.
   */
  footerAddressOverride: env('VITE_FOOTER_ADDRESS_OVERRIDE', ''),
  footerLegalOverride: env('VITE_FOOTER_LEGAL_OVERRIDE', ''),
}
