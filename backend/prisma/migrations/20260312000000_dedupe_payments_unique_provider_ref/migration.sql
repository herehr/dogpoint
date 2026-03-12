-- Remove duplicate Payment rows (keep one per provider+providerRef, keep earliest by id)
DELETE FROM "Payment" p1
USING "Payment" p2
WHERE p1."provider" = p2."provider"
  AND p1."providerRef" = p2."providerRef"
  AND p1."providerRef" IS NOT NULL
  AND p1.id > p2.id;

-- Add unique constraint to prevent future duplicates (NULL providerRef allowed multiple times)
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerRef_key"
ON "Payment" ("provider", "providerRef");
