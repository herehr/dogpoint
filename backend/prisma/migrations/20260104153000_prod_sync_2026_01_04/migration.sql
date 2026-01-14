-- prisma/migrations/20260104153000_prod_sync_2026_01_04/migration.sql

-- DropIndex
DROP INDEX IF EXISTS "public"."Post_animalId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."Post_authorId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."Post_publishedAt_idx";

-- AlterTable
ALTER TABLE "public"."Animal" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

-- -------------------------------------------------------------------
-- HOTFIX: make migration replay-safe on a fresh shadow database
-- Some environments had Notification created in a different way,
-- but this migration assumes it already exists.
-- We ensure Notification exists BEFORE we ALTER/INDEX/FK it.
-- -------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "public"."Notification" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Ensure user FK exists (safe no-op if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
  ) THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "animalId" TEXT,
  ADD COLUMN IF NOT EXISTS "postId" TEXT;

-- AlterTable
ALTER TABLE "public"."Post"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW',
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName" TEXT,
  ADD COLUMN IF NOT EXISTS "street" TEXT,
  ADD COLUMN IF NOT EXISTS "streetNo" TEXT,
  ADD COLUMN IF NOT EXISTS "taxRequestCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxRequestSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "zip" TEXT;

-- CreateTable
CREATE TABLE "public"."TaxProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "taxId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "street" TEXT,
    "streetNo" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxRequestToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRequestToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaxProfile_userId_key" ON "public"."TaxProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxProfile_userId_idx" ON "public"."TaxProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxProfile_isCompany_idx" ON "public"."TaxProfile"("isCompany");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxProfile_taxId_idx" ON "public"."TaxProfile"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaxRequestToken_token_key" ON "public"."TaxRequestToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxRequestToken_userId_idx" ON "public"."TaxRequestToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxRequestToken_expiresAt_idx" ON "public"."TaxRequestToken"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_status_idx" ON "public"."Animal"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "public"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_postId_key" ON "public"."Notification"("userId", "postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_status_idx" ON "public"."Post"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."TaxProfile"
  ADD CONSTRAINT "TaxProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxRequestToken"
  ADD CONSTRAINT "TaxRequestToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_animalId_fkey'
  ) THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_animalId_fkey"
      FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_postId_fkey'
  ) THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "public"."Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;