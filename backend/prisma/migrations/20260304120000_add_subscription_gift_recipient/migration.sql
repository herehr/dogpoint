-- CreateTable
CREATE TABLE "SubscriptionGiftRecipient" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionGiftRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionGiftRecipient_subscriptionId_email_key" ON "SubscriptionGiftRecipient"("subscriptionId", "email");

-- CreateIndex
CREATE INDEX "SubscriptionGiftRecipient_subscriptionId_idx" ON "SubscriptionGiftRecipient"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionGiftRecipient_userId_idx" ON "SubscriptionGiftRecipient"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionGiftRecipient_email_idx" ON "SubscriptionGiftRecipient"("email");

-- AddForeignKey
ALTER TABLE "SubscriptionGiftRecipient" ADD CONSTRAINT "SubscriptionGiftRecipient_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionGiftRecipient" ADD CONSTRAINT "SubscriptionGiftRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
