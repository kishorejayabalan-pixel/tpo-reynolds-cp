-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Promotion" ADD COLUMN "createdByRunId" TEXT;

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "mode" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "targetJson" JSONB;
