-- Add bank access timeline columns (safe / idempotent)
ALTER TABLE "public"."Subscription"
  ADD COLUMN IF NOT EXISTS "tempAccessUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingSince"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "graceUntil"      TIMESTAMP(3);

-- Optional indexes (safe)
CREATE INDEX IF NOT EXISTS "Subscription_tempAccessUntil_idx" ON "public"."Subscription" ("tempAccessUntil");
CREATE INDEX IF NOT EXISTS "Subscription_pendingSince_idx"    ON "public"."Subscription" ("pendingSince");
CREATE INDEX IF NOT EXISTS "Subscription_graceUntil_idx"      ON "public"."Subscription" ("graceUntil");
