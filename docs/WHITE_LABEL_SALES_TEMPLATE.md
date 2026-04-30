# White-label sales template (German fork)

Use this when you maintain a **separate repository** from DogPoint CZ: **German-first**, **easy to clone** for each new shelter / NGO client in the DACH market. Host code on **Codeberg**, run infra on **UpCloud** (or any EU VPS + managed Postgres + S3-compatible storage).

## 1. Repository strategy

| Approach | Pros | Cons |
|----------|------|------|
| **One public “template” repo** on Codeberg (`tier-adoption-template-de`) | Single place for improvements; clients fork or you duplicate | You must avoid real secrets in history |
| **Private repo per client** | Clean isolation, custom domains | More repos to patch when you fix core bugs |
| **Monorepo with `clients/acme/` config** | One CI, shared code | Heavier; clients rarely need this |

**Recommended for sales:** keep a **golden template** repo (German UI, neutral branding). For each sale:

1. **Duplicate** the template → new Codeberg project (e.g. `tierheim-muster-adoption`).
2. Fill **`client.config`** (see `docs/CLIENT_CONFIG.md` + `frontend/src/config/clientConfig.ts`) + env + deploy.
3. Optional: add the client as **collaborator** or hand over the repo after training.

## 2. What to strip or neutralize (Czech / DogPoint-specific)

Search and replace systematically (see `docs/REBRAND_GREP.md`):

- **Branding:** name, logo path, `lang`, page title, footer contacts, social URLs.
- **Email:** `emailTemplates.ts` (layout, address block, phone, legal entity line), adoption/share/tax/moderator subjects and bodies.
- **Payments:** Czech **FIO** + **variable symbol** flows may be irrelevant in DE — gate with env (`FIO_*`, bank transfer copy) or remove for Stripe-only MVP.
- **GP Webpay:** Czech gateway — disable in DE builds unless you integrate a DE/EU method.
- **Tax certificates:** Czech legal wording and entity in HTML/PDF templates — replace with lawyer-approved DE text or disable until compliant.
- **FIO client:** Regex for Czech VS (`595…`) — replace with client-specific rules or remove.
- **Analytics:** remove or replace `gtag` in `index.html`; DE often needs consent banner first.
- **LocalStorage key:** e.g. `dogpoint.access` → `app.access` or `VITE_STORAGE_PREFIX`.

## 3. Central “client profile” (make cloning fast)

Aim for **one config object** (plus env for secrets):

**Frontend (Vite — only `VITE_*` is exposed to the browser)**

- `VITE_APP_NAME`, `VITE_APP_TITLE`
- `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE` (optional)
- `VITE_LEGAL_IMPRINT_URL`, `VITE_LEGAL_PRIVACY_URL`
- `VITE_SOCIAL_*` (or empty)
- `VITE_LOGO_URL` or static asset in `/public/logo.svg`
- `VITE_PRIMARY_COLOR` / `VITE_SECONDARY_COLOR` (optional — feed MUI theme)
- `VITE_BANK_ENABLED`, `VITE_GA_MEASUREMENT_ID` (optional; see `docs/CLIENT_CONFIG.md`)

**Backend (server-only)**

- `APP_PUBLIC_NAME`, `APP_LEGAL_NAME`, `APP_LEGAL_ADDRESS`
- `APP_SUPPORT_EMAIL`, `APP_SUPPORT_PHONE`
- `FRONTEND_BASE_URL`, `APP_BASE_URL` (emails, invite links)
- `EMAIL_LOGO_URL` (absolute URL to logo for HTML mail)
- `SMTP_*` / transactional from-name
- `STRIPE_*` (EUR prices, webhook URL per deployment)
- `DATABASE_URL`, object storage keys, `JWT_SECRET`

Refactor the codebase so **DogPoint strings live in config/env**, not scattered literals — then each client fork only edits **`.env.production`** + **one `clientBrand.ts` / JSON** + **logo file**.

## 4. German “sales” defaults

- **UI language:** `lang="de"`, all user-facing copy in German (legal review for donations/adoption wording).
- **Currency:** EUR in Stripe and UI; formatting `de-DE`.
- **Legal:** Impressum + Datenschutzerklärung (host documents or static pages); cookie/consent if you use analytics or embeds.
- **Email:** German subjects/signatures; imprint line in footer.

## 5. Codeberg + CI

- Push template to Codeberg; enable **Actions** (Forgejo).
- Pipeline stages: `backend` typecheck + build, `frontend` build, optional `prisma validate`.
- Deploy: SSH to UpCloud server and `docker compose pull && up -d`, or push images to a registry — store SSH keys and env in **Codeberg secrets**.

Step-by-step for this stack: **`docs/CODEBERG_UPCLOUD.md`**.

## 6. UpCloud (typical DE stack)

- **Managed PostgreSQL** (EU region): migrations with **direct** connection; app uses pool if you add one later.
- **Object storage** (S3 API): media bucket per client or prefix per client.
- **VM(s)** or **Kubernetes:** Node backend + static frontend (nginx/Caddy) or single Compose stack.
- **TLS:** Let’s Encrypt on reverse proxy; point `api.` and `www.` to the VM/LB.

See project `DEPLOY.md` principles: **do not** run `prisma migrate` as container CMD without DB superuser; run **`migrate deploy` in CI or a one-off job**.

## 7. Sales handoff checklist (per client)

- [ ] Codeberg repo created from template; default branch protected.
- [ ] Production `.env` / secrets set (DB, JWT, Stripe, SMTP, Spaces).
- [ ] `FRONTEND_BASE_URL` + Stripe webhook URL match live domains.
- [ ] Logo + favicon + `index.html` title.
- [ ] Footer + email template legal block.
- [ ] Impressum & Datenschutz linked.
- [ ] Smoke test: register, adoption flow, payment test mode, one email received.
- [ ] Client admin account + short **PDF/video** “how to moderate animals”.

## 8. Relationship to this (Czech) repo

This file describes the **fork you maintain for DACH sales**. You can periodically **cherry-pick security and bugfixes** from `dogpoint` into the template, or merge upstream if you open-source a shared core later.

---

*Implemented in this repo (partial):* `frontend/src/config/clientConfig.ts` + `frontend/src/i18n/messages/{cs,de}.json`; set `VITE_FIO_IMPORT_UI=false` for Stripe-only admin; see `docs/CLIENT_CONFIG.md` for a deploy matrix. Remaining hardcoded copy can be migrated incrementally; use `docs/REBRAND_GREP.md` to find literals.
