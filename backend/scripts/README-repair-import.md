# One-time repair: Import Stripe + FIO payments

## What it does

1. **Backup** – Exports all `Payment` records to `backups/payments-backup-YYYY-MM-DD.json`
2. **FIO import** – Imports bank payments from 2025-12-01 to today (chunked in 90-day periods)
3. **Stripe sync** – Fetches all paid invoices from Stripe and creates missing Payment rows

Both imports are **idempotent** – no duplicate payments are created.

## How to run

**On a machine with DB access** (e.g. production server, or local with DATABASE_URL to prod):

```bash
cd backend
npm run repair:import-payments
```

**Required env vars** (in `.env`):
- `DATABASE_URL` – PostgreSQL connection string
- `FIO_TOKEN` – FIO API token (for bank import)
- `STRIPE_SECRET_KEY` – Stripe secret key (for Stripe sync)

## Output

- Backup file: `backend/backups/payments-backup-YYYY-MM-DD.json`
- Console: counts of created/skipped payments for FIO and Stripe
