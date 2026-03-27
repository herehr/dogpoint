# Dogpoint – release notes (for stakeholders)

**Environment:** production deployment from `main`  
**Scope:** features and fixes developed and tested on the dev branch; no intentional changes to unrelated behaviour.

---

## User-facing (patrons & visitors)

### Help & FAQ
- New **FAQ page** at **`/caste-dotazy`** (“Časté dotazy”) with answers about adoption, payment, account, sharing access, tax data, and troubleshooting.
- **Search** on the FAQ page (filters sections; works without special characters in Czech).
- **Links to FAQ** from the header, footer, login, password reset, adoption payment step, invite page, “My adoptions”, animal detail (for paying supporters), and the “Share with a friend” dialog.

### Remote adoption & sharing
- **“Share with a friend”** (email invite): a paying supporter can invite someone to **view updates** for the same animal without paying. Invites are limited by the rules already configured on the server (e.g. number of active shares, invite expiry).
- **Invite acceptance** flow improvements (login / registration, email matching).
- When the **paying supporter cancels** an adoption, **shared viewers** are notified by email and lose access tied to that adoption (same day), with an optional link if they wish to support the animal themselves.

### Account & email
- **Password reset emails** use the correct **public site URL** when only the frontend base URL is configured (common on staging/dev; production unchanged if `APP_BASE_URL` / `FRONTEND_BASE_URL` are already set).
- **Email delivery** configuration is more robust: the same SMTP settings can be provided under common alternative variable names (`SMTP_*` / `MAIL_*` in addition to `EMAIL_*`). A **`/health/email`** check on the API helps verify configuration without exposing secrets.

### “My adoptions” dashboard
- The **gift / “Darovat adopci”** shortcut was **removed from this screen** to simplify the layout; **“Share with a friend”** remains (green icon). (Backend capabilities for gift recipients are unchanged.)

---

## Operations & support

- **`GET /health/email`** – quick check whether SMTP is configured for transactional mail.
- **`GET /api/email/test?to=...`** – returns **503** if mail is not configured (instead of looking successful when nothing was sent).
- **Moderation notification emails** use the same central mail configuration as the rest of the app.

---

## What we did *not* change in this release

- No change to core **monthly subscription** pricing logic beyond existing flows.
- **Extra one-off holiday donations** (e.g. Easter / Christmas top-ups) are **not** in this release; they remain a possible future enhancement.
- **Bank / FIO** adoption flows are unchanged except where they share the same SMTP env resolution as above.

---

## Deployment checklist (hosting)

1. **Backend:** deploy new build; ensure **SMTP** env vars are set (`EMAIL_*` and/or `SMTP_*` / `MAIL_*` as documented in `backend/.env.example`). Run DB migrations only if your pipeline includes new migrations (this release is primarily application code).
2. **Frontend:** deploy new static build; no new required env vars for FAQ (optional: existing `VITE_*` flags remain optional).
3. Confirm **`FRONTEND_BASE_URL` / `APP_BASE_URL`** on production match the real public website (for links inside emails).

---

*For technical detail, see git history on `main` from the previous production tag to current `HEAD`.*
