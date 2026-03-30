# Dogpoint – release notes (for stakeholders)

**Environment:** production deployment from `main`  
**Scope:** features and fixes developed on dev and merged to `main`; behaviour outside these areas was not intentionally changed.

---

## 1. Supporters & visitors (public site)

### Help & FAQ
- New **FAQ page** at **`/caste-dotazy`** (“Časté dotazy”) covering adoption, payment, account, **sharing access**, tax data, and troubleshooting.
- **Search** on the FAQ (filters sections; Czech-friendly, including words with diacritics).
- **Links to FAQ** from the header, footer, login, password reset, adoption payment step, invite page, “My adoptions”, animal detail (for paying supporters), and the “Share with a friend” dialog.

### “Share with a friend” (remote viewing without paying)
- A **paying supporter** can invite others by email to **follow the same animal’s updates** without subscribing themselves.
- **Up to five** people can have this kind of shared access **per adoption** (combined accepted invites / shared viewers). The system blocks further invites once that limit is reached.
- Invites have a **limited validity period** (server-configurable expiry, typically a few days to weeks).
- **Accepting an invite** is smoother: dedicated flows for **register vs login**, clearer handling when the email must match the invitation, and better matching for common email variants (e.g. Gmail).
- **People who only have shared access** see a clearer experience: e.g. who invited them, combined view where relevant, and **share / cancel adoption** actions hidden where they do not apply.

### When the paying supporter stops supporting
- If the **subscriber cancels** an adoption, **people who were only viewing via a share** are **notified by email**, lose access tied to that adoption **the same day**, and may see a link if they want to become supporters themselves.

### “My adoptions” dashboard
- The **“Darovat adopci” / gift shortcut** was **removed from this screen** to reduce clutter. **“Share with a friend”** stays (green icon). Backend behaviour for gift recipients was not removed—only this shortcut on this page.

---

## 2. Account, passwords & email delivery

- **Password reset** links in email use the correct **public website URL** when only the frontend base URL is set (helps staging; production is unchanged if `APP_BASE_URL` / `FRONTEND_BASE_URL` were already correct).
- **SMTP settings** can be supplied under the usual names **or** common alternatives (`EMAIL_*`, **`SMTP_*`**, **`MAIL_*`**, including password aliases), so hosting panels that use different names still work.
- **`GET /health/email`** on the API reports whether transactional mail is configured (without exposing secrets).
- **`GET /api/email/test?...`** returns a clear **error if mail is not configured** (instead of appearing to succeed when nothing was sent).
- **Moderation notification emails** use the **same** central mail configuration as the rest of the application.

---

## 3. Shelter staff / administration (back office)

These changes improve **visibility** and **reconciliation** of payments; they do not replace your bank or Stripe dashboards.

- **Admin statistics:** clearer **income reporting** with a **monthly chart** comparing **card (Stripe)** vs **bank (FIO)** where applicable; counting rules were tightened so statistics reflect real **invoice/settlement** flows more accurately.
- **Stripe:** tooling to **sync** paid invoices into the app’s payment records, better handling of recurring subscriptions in webhooks, and diagnostics when something cannot be matched. Optional **repair / import** flows help align history when records were missing or duplicated (including safeguards such as backup before bulk repair).
- **FIO (bank):** import behaviour and matching were improved (e.g. variable symbol handling, time windows, diagnostics). Imports can be limited to a **recent period** where the bank API allows it without extra authentication.
- **Share invites:** admin overview includes **metrics** on shared invitations (counts / breakdown) for operational insight.

---

## 4. What we did *not* include in this round

- **Seasonal one-off donations** (e.g. Easter / Christmas extras on top of the subscription) are **not** part of this release.
- **Core subscription pricing rules** for adopters were not redesigned; existing flows stay as before.
- **Patron bank transfer (FIO) adoption flow** as experienced by users is unchanged in essence; back-office import and stats tooling improved as above.

---

## 5. Deployment checklist (hosting)

1. **Backend:** deploy the new build; set **SMTP** as in `backend/.env.example` (`EMAIL_*` and/or `SMTP_*` / `MAIL_*`). **Run database migrations** as part of your deploy if your pipeline applies them (this release may include schema changes for payments, share invites, and backups—follow your usual process).
2. **Frontend:** deploy the new static build. Optional: `VITE_DASHBOARD_HIDE_GIFT_UI` if you want to hide gift UI in more places (see codebase).
3. Confirm **`FRONTEND_BASE_URL` / `APP_BASE_URL`** in production match the real public site (for links inside emails).

---

*For technical detail, compare git history on `main` to your previous production tag or release commit.*
