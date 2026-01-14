/*
  Warnings:

  - A unique constraint covering the columns `[provider,providerRef]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropIndex
DROP INDEX "public"."Notification_userId_idx";

-- DropIndex
DROP INDEX "public"."Payment_subscriptionId_providerRef_key";

-- AlterTable
ALTER TABLE "public"."Pledge" ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "variableSymbol" TEXT;

-- AlterTable
ALTER TABLE "public"."Subscription" ADD COLUMN     "graceUntil" TIMESTAMP(3),
ADD COLUMN     "pendingSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "tempAccessUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerRef_key" ON "public"."Payment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "Pledge_subscriptionId_idx" ON "public"."Pledge"("subscriptionId");

-- CreateIndex
CREATE INDEX "Pledge_userId_idx" ON "public"."Pledge"("userId");

-- CreateIndex
CREATE INDEX "Subscription_pendingSince_idx" ON "public"."Subscription"("pendingSince");

-- CreateIndex
CREATE INDEX "Subscription_tempAccessUntil_idx" ON "public"."Subscription"("tempAccessUntil");

-- CreateIndex
CREATE INDEX "Subscription_graceUntil_idx" ON "public"."Subscription"("graceUntil");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
