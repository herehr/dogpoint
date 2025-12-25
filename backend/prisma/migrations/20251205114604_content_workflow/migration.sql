/* 20251205114604_content_workflow — patched to be idempotent on Postgres */

-- 1) Enum type: only create if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentStatus') THEN
    CREATE TYPE "public"."ContentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');
  END IF;
END $$;

-- 2) Add columns safely (split into IF NOT EXISTS per column)
ALTER TABLE "public"."Animal" ADD COLUMN IF NOT EXISTS "status" "public"."ContentStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "public"."Animal" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "public"."Animal" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

ALTER TABLE "public"."Post" ADD COLUMN IF NOT EXISTS "status" "public"."ContentStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "public"."Post" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "public"."Post" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

-- 3) Foreign keys: create only if missing (Postgres has no IF NOT EXISTS for constraints)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Animal_createdById_fkey') THEN
    ALTER TABLE "public"."Animal"
      ADD CONSTRAINT "Animal_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Animal_approvedById_fkey') THEN
    ALTER TABLE "public"."Animal"
      ADD CONSTRAINT "Animal_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_createdById_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_approvedById_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Helpful indexes (safe)
CREATE INDEX IF NOT EXISTS "Animal_status_idx" ON "public"."Animal" ("status");
CREATE INDEX IF NOT EXISTS "Post_status_idx"   ON "public"."Post" ("status");