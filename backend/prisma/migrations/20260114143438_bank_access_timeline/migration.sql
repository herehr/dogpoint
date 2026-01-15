-- DropIndex
DROP INDEX "public"."Payment_subscriptionId_providerRef_key";

-- DropIndex
DROP INDEX "public"."Post_animalId_idx";

-- DropIndex
DROP INDEX "public"."Post_authorId_idx";

-- DropIndex
DROP INDEX "public"."Post_publishedAt_idx";

-- AlterTable
ALTER TABLE "public"."Post" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "streetNo" TEXT,
ADD COLUMN     "taxRequestCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxRequestSentAt" TIMESTAMP(3),
ADD COLUMN     "zip" TEXT;

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

-- CreateTable
CREATE TABLE "public"."Notification" (
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

-- CreateIndex
CREATE UNIQUE INDEX "TaxProfile_userId_key" ON "public"."TaxProfile"("userId");

-- CreateIndex
CREATE INDEX "TaxProfile_userId_idx" ON "public"."TaxProfile"("userId");

-- CreateIndex
CREATE INDEX "TaxProfile_isCompany_idx" ON "public"."TaxProfile"("isCompany");

-- CreateIndex
CREATE INDEX "TaxProfile_taxId_idx" ON "public"."TaxProfile"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRequestToken_token_key" ON "public"."TaxRequestToken"("token");

-- CreateIndex
CREATE INDEX "TaxRequestToken_userId_idx" ON "public"."TaxRequestToken"("userId");

-- CreateIndex
CREATE INDEX "TaxRequestToken_expiresAt_idx" ON "public"."TaxRequestToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "public"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_postId_key" ON "public"."Notification"("userId", "postId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."TaxProfile" ADD CONSTRAINT "TaxProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxRequestToken" ADD CONSTRAINT "TaxRequestToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
