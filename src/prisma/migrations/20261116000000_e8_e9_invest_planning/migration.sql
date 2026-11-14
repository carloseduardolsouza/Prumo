-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "investmentOpId" TEXT;

-- CreateTable
CREATE TABLE "brokerages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brokerages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_operations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "brokerageId" TEXT NOT NULL,
    "investmentId" TEXT,
    "date" DATE NOT NULL,
    "quantity" DECIMAL(24,8),
    "unitPrice" DECIMAL(19,6),
    "amount" DECIMAL(19,4) NOT NULL,
    "fees" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "dividendKind" TEXT,
    "walletId" TEXT,
    "note" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_quotes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(19,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_targets" (
    "userId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "percent" DECIMAL(7,4) NOT NULL,

    CONSTRAINT "allocation_targets_pkey" PRIMARY KEY ("userId","assetClass")
);

-- CreateTable
CREATE TABLE "investor_profiles" (
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "price" DECIMAL(19,6) NOT NULL,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetAmount" DECIMAL(19,4) NOT NULL,
    "targetDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_invest_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "brokerageId" TEXT NOT NULL,
    "investmentId" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_invest_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brokerages_userId_name_key" ON "brokerages"("userId", "name");

-- CreateIndex
CREATE INDEX "investments_userId_idx" ON "investments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "investments_userId_ticker_key" ON "investments"("userId", "ticker");

-- CreateIndex
CREATE INDEX "investment_operations_userId_date_idx" ON "investment_operations"("userId", "date");

-- CreateIndex
CREATE INDEX "investment_operations_userId_investmentId_idx" ON "investment_operations"("userId", "investmentId");

-- CreateIndex
CREATE INDEX "investment_quotes_userId_idx" ON "investment_quotes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "investment_quotes_investmentId_date_key" ON "investment_quotes"("investmentId", "date");

-- CreateIndex
CREATE INDEX "price_alerts_userId_idx" ON "price_alerts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_userId_categoryId_key" ON "budgets"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");

-- CreateIndex
CREATE INDEX "goal_contributions_goalId_idx" ON "goal_contributions"("goalId");

-- CreateIndex
CREATE INDEX "auto_invest_rules_userId_idx" ON "auto_invest_rules"("userId");

-- CreateIndex
CREATE INDEX "ledger_entries_investmentOpId_idx" ON "ledger_entries"("investmentOpId");

