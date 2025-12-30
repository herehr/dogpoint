-- Create TaxProfile (1:1 with User via userId UNIQUE)
CREATE TABLE IF NOT EXISTS "TaxProfile" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "isCompany" BOOLEAN NOT NULL DEFAULT false,
  "companyName" TEXT,
  "taxId"     TEXT,
  "firstName" TEXT,
  "lastName"  TEXT,
  "street"    TEXT,
  "streetNo"  TEXT,
  "zip"       TEXT,
  "city"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxProfile_userId_key" UNIQUE ("userId"),
  CONSTRAINT "TaxProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TaxProfile_userId_idx" ON "TaxProfile"("userId");
CREATE INDEX IF NOT EXISTS "TaxProfile_isCompany_idx" ON "TaxProfile"("isCompany");
CREATE INDEX IF NOT EXISTS "TaxProfile_taxId_idx" ON "TaxProfile"("taxId");


-- Create TaxRequestToken (many per user)
CREATE TABLE IF NOT EXISTS "TaxRequestToken" (
  "id"        TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaxRequestToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxRequestToken_token_key" UNIQUE ("token"),
  CONSTRAINT "TaxRequestToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TaxRequestToken_userId_idx" ON "TaxRequestToken"("userId");
CREATE INDEX IF NOT EXISTS "TaxRequestToken_expiresAt_idx" ON "TaxRequestToken"("expiresAt");
