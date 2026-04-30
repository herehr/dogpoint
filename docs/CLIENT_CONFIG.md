# Client config (white-label / per-deployment)

The frontend reads branding and feature flags from **`VITE_*`** environment variables and small JSON message bundles: `frontend/src/config/clientConfig.ts`, `frontend/src/i18n/messages/cs.json`, `frontend/src/i18n/messages/de.json`.

Czech (Dogpoint) production stays the default if you do not set these variables. For a **German-first, neutral** prospect build (e.g. `adoption.fundraising-hub.com`), set `VITE_LOCALE=de`, `VITE_HTML_LANG=de`, neutral `VITE_APP_NAME` / `VITE_LOGO_URL`, and point legal URLs to your static Impressum / Datenschutz pages.

## Deploy shape (example)

- **App host:** e.g. `adoption.fundraising-hub.com` (static site from `frontend` build, same flow as `DEPLOY.md` — do not use DB-superuser migrate in the container entrypoint; run `prisma migrate deploy` in CI or a one-off job).
- **API:** e.g. `api.adoption.fundraising-hub.com` (or same host path prefix behind a reverse proxy).
- **Data residency:** use an EU region for managed PostgreSQL, object storage, and the app VM if you need “data in the EU” in sales material (see `docs/WHITE_LABEL_SALES_TEMPLATE.md`).

## Frontend variables

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend origin (e.g. `https://api.example.com`). |
| `VITE_APP_NAME` | Short name (logo `alt`, etc.). |
| `VITE_APP_TITLE` | `document.title`. |
| `VITE_LOCALE` | `cs` or `de` — picks `cs.json` / `de.json` strings. |
| `VITE_HTML_LANG` | `<html lang>`. |
| `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_PHONE_TEL` | Footer and contact. |
| `VITE_LEGAL_IMPRINT_URL`, `VITE_LEGAL_PRIVACY_URL` | If set, used as **external** links (privacy can replace the default in-app page link). |
| `VITE_LOGO_URL` | Path under `/public` or full URL. |
| `VITE_PRIMARY_COLOR`, `VITE_SECONDARY_COLOR`, `VITE_BRAND_DARK` | MUI theme + `brand` palette. |
| `VITE_STORAGE_PREFIX` | Prefix for e.g. notification last-seen in `localStorage` (separate from legacy token keys). |
| `VITE_FIO_IMPORT_UI` | `true` (default) / `false` — show FIO import + FIO admin stats and chart in Admin → Statistiky. **Use `false` for Stripe-only DE demos.** |
| `VITE_SOCIAL_LINKS_JSON` | e.g. `[{"label":"Instagram","href":"https://…"}]`. |
| `VITE_GA_MEASUREMENT_ID` | GA4 id; if empty, **no gtag** is injected (Czech prod historically used `G-GT2K977M1R` — set in CI for that site). |
| `VITE_FOOTER_ADDRESS_OVERRIDE`, `VITE_FOOTER_LEGAL_OVERRIDE` | Optional (multiline) overrides for footer columns 2–3. |
| `VITE_BANK_ENABLED` | (existing) bank-transfer adoption UI — usually off for DE. |

## Backend (separate from Vite)

Use server-only env for SMTP, `FRONTEND_BASE_URL`, Stripe keys, and disable **FIO cron / routes** in a given deployment if you are not using Czech bank import (no `VITE_*` for that; configure the Node process / App Platform as in `DEPLOY.md`).

## Related docs

- `docs/WHITE_LABEL_SALES_TEMPLATE.md` — DACH / sales process.
- `docs/REBRAND_GREP.md` — find remaining Dogpoint / CZ strings to neutralise.
