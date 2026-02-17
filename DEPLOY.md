# DigitalOcean App Platform – Deployment Notes

## 1. Database: SUPERUSER for migrations

**Problem:** `prisma migrate deploy` fails with "database user lacks SUPERUSER role".

**Options:**

### A) Grant SUPERUSER (recommended if you control the DB)
In your PostgreSQL client, connect as a superuser and run:
```sql
ALTER USER your_db_user WITH SUPERUSER;
```

### B) Skip migrations in Run Command (temporary workaround)
In DO App Platform → your backend service → Settings → Run Command, change from:
```
npm run start:with-migrate
```
to:
```
npm run start:prod
```
Then run migrations manually (e.g. from your laptop with `DATABASE_URL` pointing to prod):
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
