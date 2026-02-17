# DigitalOcean App Platform – Deployment Notes

## Quick checklist (fix "SUPERUSER" / connection errors)

1. **Run Command** – App Platform → Backend → Settings → Run Command: `node dist/index.js` or **leave empty**. Never use `npm run start:with-migrate`.
2. **DATABASE_URL** – Use the **Connection Pool** URL from your DB cluster (port **25061**), not the direct connection (25060). In DO: Databases → your cluster → Connection Details → **Connection pool** tab → copy the URI.
3. **Health check** – Use `GET /health` (not `/health/db`). Path: `/health`.

---

## 1. Database connection

**CRITICAL:** In DO App Platform → Backend → Settings → **Run Command**: set to `node dist/index.js` or leave **empty**. Do NOT use `npm run start:with-migrate`.

**Problem:** "Database user lacks SUPERUSER" or connection failures.

### Use the Connection Pool URL (fixes pool exhaustion)

DigitalOcean Managed PostgreSQL has two connection types:

| Type            | Port  | Use case                          |
|-----------------|-------|-----------------------------------|
| Direct          | 25060 | Migrations, admin tools           |
| **Connection pool** | **25061** | **App runtime (recommended)** |

For `DATABASE_URL`, use the **Connection pool** URI from: Databases → your cluster → Connection Details → **Connection pool** tab. It looks like:

```
postgresql://user:pass@host.db.ondigitalocean.com:25061/defaultdb?sslmode=require
```

The backend adds `connection_limit=5` automatically if missing.

### Options if you still get SUPERUSER

**A) Grant SUPERUSER** (if you control the DB)
```sql
ALTER USER your_db_user WITH SUPERUSER;
```

**B) Skip migrations** (Dockerfile default)
The Dockerfile runs `node dist/index.js` (no migrations). Run migrations manually:
```bash
cd backend && npx prisma migrate deploy --schema=./prisma/schema.prisma
```

---

## 2. npm version

**Problem:** Outdated npm causes compatibility issues.

**Fix:** `package.json` now has `"engines": {"npm": ">=10.0.0"}`. Ensure your DO build uses Node 20+ (which ships with npm 10+). In DO App Platform → Build Settings, set Node version to 20.x if needed.

---

## 3. Health check / port 8080

**Problem:** Health check fails – server not responding on port 8080.

**Fix:** The backend uses `process.env.PORT || 8080`. DigitalOcean sets `PORT=8080` automatically. If the health check still fails:

- **Likely cause:** The app crashes before listening (e.g. migration fails → process exits → no server).
- **Solution:** Fix the migration issue (see #1). Once the app starts, it will listen on 8080.

**Health check path:** Configure DO to check `GET /health` (the backend exposes this).
