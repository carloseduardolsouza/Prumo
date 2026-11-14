-- CreateEnum
CREATE TYPE "DebtKind" AS ENUM ('REAL_ESTATE', 'VEHICLE', 'PERSONAL', 'PAYROLL', 'STUDENT', 'PRIVATE', 'OTHER');

-- CreateEnum
CREATE TYPE "AmortSystem" AS ENUM ('PRICE', 'SAC');

-- CreateEnum
CREATE TYPE "ScheduleSource" AS ENUM ('CALCULATED', 'IMPORTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'CANCELED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED_PAYOFF');

-- CreateEnum
CREATE TYPE "ConsortiumKind" AS ENUM ('REAL_ESTATE', 'VEHICLE', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsortiumStatus" AS ENUM ('ACTIVE', 'CONTEMPLATED', 'CANCELED', 'CLOSED');

-- CreateTable
CREATE TABLE "financings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditor" TEXT,
    "kind" "DebtKind" NOT NULL,
    "contractedAmount" DECIMAL(19,4) NOT NULL,
    "downPayment" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "financedAmount" DECIMAL(19,4) NOT NULL,
    "monthlyRate" DECIMAL(9,6) NOT NULL,
    "annualCet" DECIMAL(9,4),
    "system" "AmortSystem" NOT NULL,
    "installments" INTEGER NOT NULL,
    "feePerInstallment" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "contractDate" DATE NOT NULL,
    "firstDueDate" DATE NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "walletId" TEXT,
    "scheduleSource" "ScheduleSource" NOT NULL DEFAULT 'CALCULATED',
    "officialBalance" DECIMAL(19,4),
    "officialBalanceAt" DATE,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "paidOffDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financing_installments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principal" DECIMAL(19,4) NOT NULL,
    "interest" DECIMAL(19,4) NOT NULL,
    "fees" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lateFee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paidDate" DATE,
    "transactionId" TEXT,

    CONSTRAINT "financing_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financing_extra_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "mode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financing_extra_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortiums" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "administrator" TEXT,
    "groupNumber" TEXT,
    "quota" TEXT,
    "kind" "ConsortiumKind" NOT NULL,
    "initialLetter" DECIMAL(19,4) NOT NULL,
    "currentLetter" DECIMAL(19,4) NOT NULL,
    "installments" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(19,4) NOT NULL,
    "contractDate" DATE NOT NULL,
    "firstDueDate" DATE NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "adminFeeRate" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "reserveFundRate" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "insuranceFee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "adjustmentRule" TEXT,
    "nextAssemblyDate" DATE,
    "walletId" TEXT,
    "status" "ConsortiumStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consortiums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_installments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lateFee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paidDate" DATE,
    "transactionId" TEXT,

    CONSTRAINT "consortium_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_adjustments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "previous" DECIMAL(19,4) NOT NULL,
    "next" DECIMAL(19,4) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consortium_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "modality" TEXT,
    "amount" DECIMAL(19,4),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consortium_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financings_userId_status_idx" ON "financings"("userId", "status");

-- CreateIndex
CREATE INDEX "financing_installments_userId_dueDate_idx" ON "financing_installments"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "financing_installments_financingId_number_key" ON "financing_installments"("financingId", "number");

-- CreateIndex
CREATE INDEX "consortiums_userId_status_idx" ON "consortiums"("userId", "status");

-- CreateIndex
CREATE INDEX "consortium_installments_userId_dueDate_idx" ON "consortium_installments"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "consortium_installments_consortiumId_number_key" ON "consortium_installments"("consortiumId", "number");

-- AddForeignKey
ALTER TABLE "financings" ADD CONSTRAINT "financings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_installments" ADD CONSTRAINT "financing_installments_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_extra_payments" ADD CONSTRAINT "financing_extra_payments_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortiums" ADD CONSTRAINT "consortiums_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_installments" ADD CONSTRAINT "consortium_installments_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortiums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_adjustments" ADD CONSTRAINT "consortium_adjustments_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortiums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_events" ADD CONSTRAINT "consortium_events_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortiums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

