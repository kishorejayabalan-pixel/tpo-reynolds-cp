-- CreateTable
CREATE TABLE "SignalTick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "retailerId" TEXT,
    "category" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AutopilotState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerId" TEXT NOT NULL,
    "lastRoiBelowTarget" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retailerId" TEXT,
    "agent" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeKpiJson" TEXT NOT NULL,
    "afterKpiJson" TEXT,
    "diff" TEXT,
    "signalContext" TEXT,
    "signals" TEXT,
    "constraints" TEXT,
    "kpiBefore" TEXT,
    "kpiAfter" TEXT,
    "top5" TEXT,
    "explanation" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "AutopilotState_retailerId_key" ON "AutopilotState"("retailerId");
