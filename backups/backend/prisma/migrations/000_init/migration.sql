-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'MOCK', 'FIO', 'GPWEBPAY');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REQUIRES_ACTION', 'CANCELED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CARD', 'BANK');

-- CreateEnum
CREATE TYPE "public"."PaymentInterval" AS ENUM ('MONTHLY');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Animal" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "jmeno" TEXT,
    "description" TEXT,
    "popis" TEXT,
    "charakteristik" TEXT,
    "birthDate" TIMESTAMP(3),
    "bornYear" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "main" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GalerieMedia" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "typ" TEXT NOT NULL DEFAULT 'image',
    "animalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalerieMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdoptionRequest" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "monthly" INTEGER,
    "lastViewedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCheckoutSessionId" TEXT,

    CONSTRAINT "AdoptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animalId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PostMedia" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "typ" TEXT NOT NULL DEFAULT 'image',
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "monthlyAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "provider" "public"."PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "variableSymbol" TEXT,
    "message" TEXT,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "status" "public"."PaymentStatus" NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FioCursor" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FioCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pledge" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "amount" INTEGER NOT NULL,
    "interval" "public"."PaymentInterval" NOT NULL DEFAULT 'MONTHLY',
    "method" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PledgePayment" (
    "id" TEXT NOT NULL,
    "pledgeId" TEXT NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "provider" TEXT,
    "providerId" TEXT,
    "orderNumber" TEXT,
    "md" TEXT,
    "redirectUrl" TEXT,
    "resultCode" TEXT,
    "resultMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PledgePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "AdoptionRequest_animalId_idx" ON "public"."AdoptionRequest"("animalId");

-- CreateIndex
CREATE INDEX "AdoptionRequest_email_animalId_idx" ON "public"."AdoptionRequest"("email", "animalId");

-- CreateIndex
CREATE INDEX "Post_animalId_idx" ON "public"."Post"("animalId");

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "public"."Post"("authorId");

-- CreateIndex
CREATE INDEX "Post_publishedAt_idx" ON "public"."Post"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_variableSymbol_key" ON "public"."Subscription"("variableSymbol");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_animalId_idx" ON "public"."Subscription"("animalId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "public"."Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_animalId_status_key" ON "public"."Subscription"("userId", "animalId", "status");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "public"."Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_subscriptionId_providerRef_key" ON "public"."Payment"("subscriptionId", "providerRef");

-- CreateIndex
CREATE INDEX "Pledge_email_animalId_idx" ON "public"."Pledge"("email", "animalId");

-- CreateIndex
CREATE INDEX "Pledge_status_method_idx" ON "public"."Pledge"("status", "method");

-- CreateIndex
CREATE UNIQUE INDEX "PledgePayment_orderNumber_key" ON "public"."PledgePayment"("orderNumber");

-- CreateIndex
CREATE INDEX "PledgePayment_pledgeId_idx" ON "public"."PledgePayment"("pledgeId");

-- CreateIndex
CREATE INDEX "PledgePayment_status_idx" ON "public"."PledgePayment"("status");

-- CreateIndex
CREATE INDEX "PledgePayment_orderNumber_idx" ON "public"."PledgePayment"("orderNumber");

-- AddForeignKey
ALTER TABLE "public"."GalerieMedia" ADD CONSTRAINT "GalerieMedia_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdoptionRequest" ADD CONSTRAINT "AdoptionRequest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PledgePayment" ADD CONSTRAINT "PledgePayment_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "public"."Pledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

