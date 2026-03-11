-- CreateTable
CREATE TABLE "PaymentBackup" (
    "id" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalId" TEXT,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentBackup_snapshotAt_idx" ON "PaymentBackup"("snapshotAt");
