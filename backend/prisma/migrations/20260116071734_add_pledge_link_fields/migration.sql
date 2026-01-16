-- Add link fields for bank/stripe flows (safe / idempotent)
ALTER TABLE "public"."Pledge"
  ADD COLUMN IF NOT EXISTS "userId"         TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "variableSymbol" TEXT;

-- Helpful indexes (optional but recommended)
CREATE INDEX IF NOT EXISTS "Pledge_subscriptionId_idx" ON "public"."Pledge" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "Pledge_userId_idx"         ON "public"."Pledge" ("userId");
