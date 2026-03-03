-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "circanaCoverage" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'Med',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SKU" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skuCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "unitCost" REAL NOT NULL,
    "basePrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PromoEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "discountDepth" REAL NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "baselineUnits" INTEGER NOT NULL,
    "promoUnits" INTEGER NOT NULL,
    "inventoryFlag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoEvent_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromoEvent_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "spend" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Budget_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_name_key" ON "Retailer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SKU_skuCode_key" ON "SKU"("skuCode");
