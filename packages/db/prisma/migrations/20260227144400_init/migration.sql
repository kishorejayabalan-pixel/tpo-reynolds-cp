-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "basePrice" REAL NOT NULL,
    "baseCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'US',
    "channel" TEXT NOT NULL DEFAULT 'Mass',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerId" TEXT NOT NULL,
    "storeType" TEXT NOT NULL DEFAULT 'Standard',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerId" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "mechanicType" TEXT NOT NULL,
    "discount" REAL NOT NULL,
    "expectedFunding" REAL NOT NULL,
    "period" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Promotion_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "forecastUnits" INTEGER NOT NULL,
    "expectedLift" REAL NOT NULL,
    "expectedRoi" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoLine_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromoLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "POS_Weekly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "revenue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "POS_Weekly_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "POS_Weekly_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventory_Weekly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL,
    "inbound" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inventory_Weekly_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_Weekly_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetitorSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "retailerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "competitorIndexPrice" REAL NOT NULL,
    "promoIntensity" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitorSignal_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textObjective" TEXT NOT NULL,
    "parsedConstraints" TEXT NOT NULL,
    "horizonStart" INTEGER,
    "horizonEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "impactSummary" TEXT,
    "diff" TEXT,
    "signalContext" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptimizationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT,
    "payload" TEXT NOT NULL,
    "scenarioCount" INTEGER NOT NULL,
    "runtimeMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OptimizationRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_name_key" ON "Retailer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_weekId_key" ON "Calendar"("weekId");
