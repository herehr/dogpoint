-- CreateEnum
CREATE TYPE "ShareInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ShareInvite" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "message" TEXT,
    "reason" TEXT,
    "status" "ShareInviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ShareInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareInvite_token_key" ON "ShareInvite"("token");

-- CreateIndex
CREATE INDEX "ShareInvite_subscriptionId_idx" ON "ShareInvite"("subscriptionId");

-- CreateIndex
CREATE INDEX "ShareInvite_recipientEmail_idx" ON "ShareInvite"("recipientEmail");

-- CreateIndex
CREATE INDEX "ShareInvite_senderId_idx" ON "ShareInvite"("senderId");

-- CreateIndex
CREATE INDEX "ShareInvite_status_idx" ON "ShareInvite"("status");

-- AddForeignKey
ALTER TABLE "ShareInvite" ADD CONSTRAINT "ShareInvite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareInvite" ADD CONSTRAINT "ShareInvite_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareInvite" ADD CONSTRAINT "ShareInvite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
