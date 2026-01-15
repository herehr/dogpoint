-- DropIndex
DROP INDEX IF EXISTS "Payment_subscriptionId_providerRef_key";

-- DropIndex
DROP INDEX IF EXISTS "public"."Post_animalId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."Post_authorId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."Post_publishedAt_idx";


-- AlterTable: Post.updatedAt (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Post'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;


-- AlterTable: User fields (guarded one-by-one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='city'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "city" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='firstName'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "firstName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='lastName'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "lastName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='street'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "street" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='streetNo'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "streetNo" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='taxRequestCount'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "taxRequestCount" INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='taxRequestSentAt'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "taxRequestSentAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='zip'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "zip" TEXT;
  END IF;
END $$;


-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "public"."TaxProfile" (
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

CREATE TABLE IF NOT EXISTS "public"."TaxRequestToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRequestToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animalId" TEXT,
    "postId" TEXT,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);


-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "TaxProfile_userId_key" ON "public"."TaxProfile"("userId");
CREATE INDEX IF NOT EXISTS "TaxProfile_userId_idx" ON "public"."TaxProfile"("userId");
CREATE INDEX IF NOT EXISTS "TaxProfile_isCompany_idx" ON "public"."TaxProfile"("isCompany");
CREATE INDEX IF NOT EXISTS "TaxProfile_taxId_idx" ON "public"."TaxProfile"("taxId");

CREATE UNIQUE INDEX IF NOT EXISTS "TaxRequestToken_token_key" ON "public"."TaxRequestToken"("token");
CREATE INDEX IF NOT EXISTS "TaxRequestToken_userId_idx" ON "public"."TaxRequestToken"("userId");
CREATE INDEX IF NOT EXISTS "TaxRequestToken_expiresAt_idx" ON "public"."TaxRequestToken"("expiresAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "public"."Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_postId_key" ON "public"."Notification"("userId", "postId");

CREATE INDEX IF NOT EXISTS "User_email_idx" ON "public"."User"("email");


-- AddForeignKey (idempotent via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaxProfile_userId_fkey') THEN
    ALTER TABLE "public"."TaxProfile"
      ADD CONSTRAINT "TaxProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaxRequestToken_userId_fkey') THEN
    ALTER TABLE "public"."TaxRequestToken"
      ADD CONSTRAINT "TaxRequestToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_animalId_fkey') THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_animalId_fkey"
      FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_postId_fkey') THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "public"."Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;