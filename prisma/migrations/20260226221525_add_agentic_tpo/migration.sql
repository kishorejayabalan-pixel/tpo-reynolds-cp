-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCost" REAL NOT NULL,
    "basePrice" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "baseUnits" INTEGER NOT NULL,
    "basePrice" REAL NOT NULL,
    "baseCost" REAL NOT NULL,
    CONSTRAINT "Baseline_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Baseline_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "promoType" TEXT NOT NULL,
    "discountPct" REAL NOT NULL,
    "displayFlag" BOOLEAN NOT NULL,
    "featureFlag" BOOLEAN NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Promotion_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "objectiveType" TEXT NOT NULL,
    "minSpend" REAL,
    "maxDiscountPct" REAL NOT NULL,
    "tradeSpendPctMin" REAL NOT NULL,
    "tradeSpendPctMax" REAL NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Objective_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectiveId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "kpisJson" JSONB NOT NULL,
    CONSTRAINT "Scenario_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectiveId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL,
    "traceJson" JSONB NOT NULL,
    CONSTRAINT "AgentRun_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
