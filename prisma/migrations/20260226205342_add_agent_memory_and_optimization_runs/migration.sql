-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "preferredObjective" TEXT DEFAULT 'maximize_margin',
    "retailerPriorities" TEXT,
    "riskTolerance" TEXT DEFAULT 'medium',
    "typicalPeriod" TEXT DEFAULT '2026-Q2',
    "constraintsJson" TEXT,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMemory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptimizationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "scenarioCount" INTEGER NOT NULL,
    "runtimeMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OptimizationRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_conversationId_key" ON "AgentMemory"("conversationId");
