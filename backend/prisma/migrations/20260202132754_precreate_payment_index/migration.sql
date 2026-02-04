CREATE INDEX IF NOT EXISTS "Payment_subscriptionId_providerRef_key"
ON "Payment" ("subscriptionId", "providerRef");
