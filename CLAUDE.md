# CLAUDE.md — DogPoint Adopce

Czech animal adoption platform with payment processing, subscriptions, and content moderation.

## Project Structure

```
adopt_final/
├── backend/          # Node.js/Express API (port 3000)
├── frontend/         # React/Vite SPA (port 5173)
├── scripts/          # Utility scripts (backup, seeding, payment sync)
├── fotos/            # Static asset storage
└── docker-compose.dev-db.yml  # Local PostgreSQL (port 55432)
```

## Tech Stack

- **Backend:** Node.js 20, TypeScript (CommonJS), Express.js, Prisma ORM
- **Frontend:** React 18, TypeScript, Vite, MUI (Material-UI), React Router 6
- **Database:** PostgreSQL 15
- **Payments:** Stripe, FIO bank import, GP Webpay (optional, feature-flagged)
- **Storage:** DigitalOcean Spaces (S3-compatible)
- **Media:** FFmpeg (video), Sharp (images), Puppeteer (PDF/QR)
- **Jobs:** node-cron (FIO import at 6am, adoption reminders)
- **Email:** Nodemailer

## Development Setup

```bash
# 1. Start local PostgreSQL
docker-compose -f docker-compose.dev-db.yml up -d

# 2. Backend
cd backend && npm install
cp .env.example .env  # fill in values
npm run migrate:dev
npm run dev           # http://localhost:3000

# 3. Frontend
cd frontend && npm install
# Create .env.local (see below)
npm run dev           # http://localhost:5173
```

### Environment Variables

**`backend/.env`** — key variables:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/dogpoint_dev
PORT=3000
NODE_ENV=development
JWT_SECRET=<secret>
CORS_ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173
DO_SPACE_KEY=...
DO_SPACE_SECRET=...
STRIPE_SECRET_KEY=sk_test_...
```

**`frontend/.env.local`**:
```
VITE_API_BASE_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Common Commands

### Backend
```bash
npm run dev                  # Dev server with hot reload
npm run build                # Compile TS → dist/
npm run typecheck            # TypeScript validation only
npm run migrate:dev          # Interactive Prisma migration
npm run migrate:deploy       # Deploy migrations (production)
npm run db:seed              # Seed database
npm run prisma:generate      # Regenerate Prisma client after schema changes
```

### Frontend
```bash
npm run dev      # Vite dev server
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

## Backend Architecture

### Route → Controller → Service → Prisma pattern

Key API routes under `/api/`:
- `auth` — JWT login/register
- `animals` — Animal listings (PENDING_REVIEW → APPROVED/REJECTED workflow)
- `adoption` — Adoption request submissions
- `adoption-bank` — Bank transfer payments
- `stripe` — Webhook + checkout sessions
- `fio` — FIO bank payment import
- `tax` — Tax certificate generation
- `admin/*` — Admin dashboard, user management, stats

### Auth middleware
- `requireAuth()` — mandatory JWT
- `requireAuthOptional()` — optional JWT
- `requireAdmin()` — ADMIN role only
- `requireStaff()` — ADMIN or MODERATOR

### User roles
`USER` → `MODERATOR` → `ADMIN`

## Database

- Prisma schema: `backend/prisma/schema.prisma`
- 23+ models: User, Animal, AdoptionRequest, Subscription, Post, Notification, TaxProfile, GalerieMedia
- 16+ migrations in `backend/prisma/migrations/`
- After schema changes: `npm run prisma:generate` then `npm run migrate:dev`

Key enums:
- `Role`: USER, MODERATOR, ADMIN
- `ContentStatus`: PENDING_REVIEW, APPROVED, REJECTED

## Payment Integration Notes

### FIO bank import
- Daily cron at 6:00 AM
- Deduplicates by `subscription + amount + paidAt date`
- Supports PENDING status for unmatched imports
- See `backend/src/fioCron.ts`

### Stripe
- Webhook-driven (not polling)
- Subscription + one-time payments
- Stripe customer ID stored on AdoptionRequest

### GP Webpay
- Optional Czech payment gateway
- Feature-flagged via environment variable

## Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| FIO import | Daily 6:00 AM | Import bank payments |
| Adoption bank | Daily | 30-day reminder, 40-day deactivation for unpaid bank transfers |
| Monthly stats email | 1st of month, 8:00 | Email stats (total income, prospected income, STRIPE/FIO chart) to `STATS_EMAIL_RECIPIENT` |
| Tax certificates | Scheduled | Annual tax certificate generation |

## Production Deployment (DigitalOcean)

- **Backend:** Docker image on App Platform → `node dist/index.js`
- **Frontend:** Static CDN hosting
- **Database:** Managed PostgreSQL + PgBouncer connection pooling (port 25061)
- **IMPORTANT:** Do NOT use `start:with-migrate` in production — DB user lacks SUPERUSER. Run migrations manually with `migrate:deploy`.
- See `DEPLOY.md` for full deployment guide.

## Conventions & Notes

- Backend uses CommonJS (`require`/`module.exports` in config, TypeScript compiled to CJS)
- Frontend uses ESNext modules
- Czech language UI (`lang="cs"`)
- Currency: CZK primary
- All media uploads go to DigitalOcean Spaces — local disk is not used for uploads
- Puppeteer uses system Chromium in Docker: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
