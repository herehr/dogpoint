/* =========================================================
   PRE-FIX for shadow DB + safe for real DB
   - Adds Post.updatedAt if missing (Prisma migration later expects it)
   - Adds Animal.updatedAt if missing (your db push complained about it)
   - Creates Notification table if missing (your earlier error)
   All steps are idempotent (IF NOT EXISTS).
========================================================= */

-- 1) Post.updatedAt (required by later migration)
ALTER TABLE "public"."Post"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2) Animal.updatedAt (required by your schema)
ALTER TABLE "public"."Animal"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3) Notification base table (later migration alters it)
CREATE TABLE IF NOT EXISTS "public"."Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- FK to User (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
  ) THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_userId_idx"
  ON "public"."Notification"("userId");
