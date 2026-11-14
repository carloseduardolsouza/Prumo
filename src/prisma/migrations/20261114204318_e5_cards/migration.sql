-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'CANCELED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LimitPolicy" AS ENUM ('CONSERVATIVE', 'INVOICE_ONLY');

-- AlterEnum
ALTER TYPE "LedgerKind" ADD VALUE 'CARD_PAYMENT';

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "brand" TEXT,
    "holder" TEXT,
    "last4" TEXT,
    "limit" DECIMAL(19,4) NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "color" TEXT,
    "limitPolicy" "LimitPolicy" NOT NULL DEFAULT 'CONSERVATIVE',
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "refYear" INTEGER NOT NULL,
    "refMonth" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "establishment" TEXT,
    "categoryId" TEXT,
    "purchaseDate" DATE NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "refundOfId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_installments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "competenceDate" DATE NOT NULL,
    "categoryId" TEXT,

    CONSTRAINT "purchase_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "feeTxId" TEXT,
    "paidDate" DATE NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_limit_adjustments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "previous" DECIMAL(19,4) NOT NULL,
    "next" DECIMAL(19,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_limit_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_cards_userId_status_idx" ON "credit_cards"("userId", "status");

-- CreateIndex
CREATE INDEX "invoices_userId_dueDate_idx" ON "invoices"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_cardId_refYear_refMonth_key" ON "invoices"("cardId", "refYear", "refMonth");

-- CreateIndex
CREATE INDEX "card_purchases_userId_purchaseDate_idx" ON "card_purchases"("userId", "purchaseDate");

-- CreateIndex
CREATE INDEX "card_purchases_cardId_idx" ON "card_purchases"("cardId");

-- CreateIndex
CREATE INDEX "purchase_installments_invoiceId_idx" ON "purchase_installments"("invoiceId");

-- CreateIndex
CREATE INDEX "purchase_installments_userId_competenceDate_idx" ON "purchase_installments"("userId", "competenceDate");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_installments" ADD CONSTRAINT "purchase_installments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "card_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_installments" ADD CONSTRAINT "purchase_installments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_limit_adjustments" ADD CONSTRAINT "card_limit_adjustments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
