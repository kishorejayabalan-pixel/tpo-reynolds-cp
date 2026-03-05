-- Rename old Scenario to ObjectiveScenario (preserve data), then create new Scenario table

-- 1. Create ObjectiveScenario with same structure as current Scenario
CREATE TABLE "ObjectiveScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectiveId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "kpisJson" TEXT NOT NULL,
    "mode" TEXT,
    "targetJson" TEXT,
    CONSTRAINT "ObjectiveScenario_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2. Copy data from Scenario to ObjectiveScenario
INSERT INTO "ObjectiveScenario" ("id", "objectiveId", "createdAt", "name", "planJson", "kpisJson", "mode", "targetJson")
SELECT "id", "objectiveId", "createdAt", "name", "planJson", "kpisJson", "mode", "targetJson" FROM "Scenario";

-- 3. Drop old Scenario table
DROP TABLE "Scenario";

-- 4. Create new Scenario table (workspace scenarios)
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "objectiveJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kpiSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Add scenarioId to PromoEvent
ALTER TABLE "PromoEvent" ADD COLUMN "scenarioId" TEXT;

-- 6. Add scenarioId to Promotion
ALTER TABLE "Promotion" ADD COLUMN "scenarioId" TEXT;
