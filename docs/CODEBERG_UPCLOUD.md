# Codeberg + UpCloud deployment

This complements `DEPLOY.md` (DigitalOcean App Platform) with a **self-hosted EU** path: **Codeberg** for Git and CI, **UpCloud** for compute, database, and storage.

## 1. Codeberg (Forgejo)

- **Repo:** host the app (template fork, or this monorepo). Use branch protection on `main`.
- **Actions:** In the Forgejo project → **Settings → Actions** — enable **Actions** if you want CI. Store secrets under **Settings → Actions → Secrets** (e.g. `UPCLOUD_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, API tokens if you use a container registry on UpCloud or another EU registry).
- **Typical pipeline:**
  1. **backend:** `npm ci` → `npm run typecheck` (and/or `build`) → `npx prisma validate` (no DB needed).
  2. **frontend:** `npm ci` → `npm run build` (set `VITE_API_BASE_URL` and other `VITE_*` for that environment via secrets / variables).
- **Do not** run `prisma migrate deploy` from the app container’s `CMD` on platforms where the DB user is not a superuser (same idea as in `DEPLOY.md`). Run migrations in CI or a one-off job with a **direct** DB URL, or from an admin machine.

## 2. UpCloud building blocks (EU)

| Piece | Role |
|-------|------|
| **Managed PostgreSQL** | Primary DB; use EU region. Use a **migrations** connection (direct) for `prisma migrate deploy`; the app can use the same DSN with pooling if you add/keep `connection_limit` in the URL. |
| **Object storage (S3 API)** | Media uploads (same pattern as DO Spaces) — separate bucket or prefix per client. |
| **Server / LB** | **VM** (e.g. Ubuntu LTS) or load balancer in front of several VMs. Run **Node 20+** for the API and **nginx** or **Caddy** for TLS + static frontend. |
| **TLS** | Let’s Encrypt (Caddy or certbot) for `app.example.com` and `api.example.com`. |
| **DNS** | A/AAAA to the VM or to the load balancer. |

## 3. Runtime layout

**Option A — Docker Compose on one VM**

- `docker compose` (or a single `Dockerfile` per service) for **backend** + **reverse proxy**; frontend is **static files** (output of `vite build`) served by nginx/Caddy.
- **Deploy** from Codeberg: SSH step `git pull` + `docker compose build --pull && docker compose up -d`, *or* pull prebuilt images from a registry your CI pushes to.
- **Secrets** on the server: `/etc/.../env` or `docker compose` `env_file`, not committed. Same variables as in `docs/CLIENT_CONFIG.md` (Vite) and backend `.env` (see `backend/.env.example` / `CLAUDE.md`).

**Option B — No Docker**

- `systemd` unit running `node dist/index.js` for the API; **nginx** serves `frontend/dist` and reverse-proxies `/api` (or a separate `api.*` host) to `127.0.0.1:3000` (or whatever `PORT` you set).

**Health check:** the backend exposes `GET /health` — point uptime checks and the reverse proxy to that (not DB-dependent, unlike a hypothetical `/health/db`).

## 4. Migrations and releases

1. **Build** backend and frontend in CI (or on the server in a deploy script).
2. **Run** `npx prisma migrate deploy` against production **before** or **as part of** a deploy, with credentials that are allowed to apply migrations (not necessarily the same URL as a restricted pooler user, depending on your provider).
3. **Restart** the API process or recreate containers.
4. **Verify** `GET /health` and a smoke test (login, one API call).

## 5. Stripe and URLs

- Set **`FRONTEND_BASE_URL`** and API base URL so emails and redirects match live hosts.
- **Stripe webhooks** must use the public HTTPS API URL; register the webhook in the Stripe dashboard (test vs live per environment).
- For static frontend, **`VITE_API_BASE_URL`** is baked in at build time — rebuild when the API base URL changes.

## 6. Checklist (minimal)

- [ ] Codeberg: repo + Actions + secrets.
- [ ] UpCloud: DB + (optional) object storage + VM/LB in EU.
- [ ] DNS + TLS for app and API.
- [ ] Production `.env` for backend; CI/build vars for `VITE_*`.
- [ ] Migrations run outside the container entrypoint, per `DEPLOY.md` spirit.
- [ ] Monitoring / backups for PostgreSQL and object storage.

See also: `docs/WHITE_LABEL_SALES_TEMPLATE.md` (§5–6), `docs/CLIENT_CONFIG.md` (Vite / branding), `DEPLOY.md` (migrations, health, pool URL concepts — adapt hostnames from DigitalOcean to UpCloud).
