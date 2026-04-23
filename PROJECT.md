# DogPoint Adopce — project overview

**DogPoint Adopce** is a Czech **animal adoption / patron** web platform. Shelters list animals; visitors can start **adoptions** (monthly support or one-off flows) with **Stripe**, **FIO bank import**, and optional **GP Webpay**. Staff use an **admin** area for moderation, users, and statistics. The public site is **Czech** (`lang="cs"`); documentation for developers and this file are maintained primarily in **English**.

This file gives a **single-place description** of the system and a **running log of developments** (features and notable changes) so the team can track what we ship. For **stakeholder-facing** wording, use `docs/CLIENT_RELEASE_NOTES.md`. For **local setup and command cheat sheet**, use `CLAUDE.md`. For **production deployment**, use `DEPLOY.md`.

---

## What the system does (domains)

| Domain | Description |
|--------|-------------|
| **Animals** | Listings, media, status workflow (e.g. pending review → approved). |
| **Adoption & payments** | Subscriptions, Payment records, bank transfer flows, FIO/Stripe, webhooks. |
| **Patrons (paying supporters)** | Users with active/pending subscription tied to an animal. |
| **“Guest” / shared access** | A **patron** can **invite by email** someone to **view the same adoption without paying** (Share invite). Counts: `ShareInvite` rows (invites sent) and `ACCEPTED` / `SubscriptionGiftRecipient` (guests added) — see **Admin → stats** and `GET /api/admin/stats/share-invites` (separate from payment/adoption detail tables). |
| **Content & moderation** | Posts, moderation queue, staff roles (USER / MODERATOR / ADMIN). |
| **Tax / certificates** | Tax profiles and certificate flows (see app routes and jobs). |
| **FAQ** | Public FAQ with search and structured sections (`/caste-dotazy`). |

---

## Repository layout

```
adopt_final/
├── backend/                 # Node 20, Express, Prisma, port 3000 in dev
├── frontend/                # React 18, Vite, MUI, port 5173 in dev
├── docs/                    # Extra docs (release notes, FAQ notes, etc.)
├── scripts/                 # Shell utilities (e.g. payment helpers)
├── fotos/                   # Local asset area (uploads go to object storage in prod)
├── CLAUDE.md                # Dev setup, stack, common commands
├── DEPLOY.md                # DigitalOcean App Platform notes
└── PROJECT.md               # This file
```

---

## Key technical references

| Topic | Where |
|--------|--------|
| Stack, env vars, `npm` commands | `CLAUDE.md` |
| DO deploy, migrations, Node version | `DEPLOY.md` |
| Stakeholder release notes | `docs/CLIENT_RELEASE_NOTES.md` |
| Prisma schema & migrations | `backend/prisma/` |
| **Background jobs (cron)** | `backend/src/jobs/` (see table below) |

### Background jobs (summary)

| Job | File / entry | Notes |
|-----|----------------|--------|
| FIO bank import | `fioCron.ts` | Default daily ~06:00 (server TZ); env `FIO_CRON_*` |
| Adoption bank (reminders / deactivation) | `adoptionBankCron.ts` | |
| **Stripe → Payment table sync** | `stripeSyncCron.ts` | Daily; same logic as admin “Stripe sync”; `STRIPE_SYNC_CRON_*` |
| Monthly stats email | `monthlyStatsCron.ts` | Code exists; must call `startMonthlyStatsCron()` in `index.ts` if you want it live — `STATS_EMAIL_RECIPIENT` |
| Tax certificates | Scheduled jobs as configured | |

*Exact schedules and which crons are started are defined in `backend/src/index.ts` and env.*

---

## API surface (non-exhaustive)

- **Public + auth:** `/api/auth`, `/api/animals`, `/api/adoption`, `/api/stripe` (incl. webhook), etc.
- **Admin:** `/api/admin/*` — stats, users, Stripe sync, FIO import triggers, `GET /api/admin/stats/share-invites`, `GET /api/admin/stats/adoptions/export.json` (JSON mirror of CSV adopters), etc.

---

# Development log

*Append new entries at the **top** with date and short title. List concrete areas (backend/frontend) and key files or endpoints when useful.*

### 2026-03-30 — Admin stats: search, donors JSON, names, last-year range (frontend + backend)

- **Detail tables** (Admin → Statistiky): client-side **search** (diacritic-insensitive) over the current tab; optional row counts when filtered.
- **Donor / subscription preview (same as CSV)**: `GET /api/admin/stats/adoptions/export.json` + in-browser table and search; shared loader `loadSubscriptionExportRows()` in `adminStats` routes.
- **Columns**: `firstName` / `lastName` on **payments**, **pledges**, **expected** detail APIs where user data exists; pledge payments and pledge rows resolve names by email when needed. Payments table includes **Reference** (`providerRef`); pledges include **VS** where applicable.
- **Date presets**: **Minulý rok** (previous calendar year) next to “Tento měsíc” / “Tento rok”.

### 2026-03-30 — Stripe: automatic daily sync into `Payment` (backend)

- **Cron** `startStripeSyncCron()`: calls `runStripeSync()` (same as manual admin Stripe sync) on a schedule (default `30 6 * * *` UTC; override `STRIPE_SYNC_CRON_SCHEDULE`).
- **Postgres advisory lock** shared helper: `pgAdvisoryLock.ts` (FIO and Stripe use different lock keys to avoid double runs across instances).
- **Env:** `STRIPE_SYNC_CRON_ENABLED`, `STRIPE_SYNC_CRON_SCHEDULE`, `STRIPE_SYNC_CRON_RUN_ON_INIT` (see `backend/.env.example`).

### 2026-03-30 (earlier) — FAQ page UI (frontend)

- **Accordion** sections aligned with public dog-point.cz style (pale panels `#E6F7F8`, spacing, chevrons).
- **Content**: `frontend/src/content/faq.md` with parser `parseFaqMarkdown.ts` (sections: accordion vs markdown for links table).

### Git / release branches

- Work is typically merged to **`main`**; **`dev`** is often fast-forwarded to match `main` for environments that track `dev`. Production **deploy** is still via **DigitalOcean** (or your host): push triggers build only if the app is connected to the branch.

### Metrics: guest invites vs payments

- **Guest invitations** (no payment for the guest): use **`ShareInvite`** counts and `GET /api/admin/stats/share-invites` (`totalSent` ≈ all invites; `accepted` = invite accepted and guest access granted). **Do not** use payment CSV or payment-only tables for this question.
- **SMTP delivery** of invite emails is not stored row-by-row; `totalSent` is “invite records created / email send attempted”.

---

## How to update this file

1. After a meaningful feature or fix, add a **dated subsection** under **Development log**.
2. If architecture changes (new service, new cron, major route), update the **summary tables** above.
3. Keep `docs/CLIENT_RELEASE_NOTES.md` in sync for non-technical readers when the change is user-visible.

---

*End of `PROJECT.md`.*
