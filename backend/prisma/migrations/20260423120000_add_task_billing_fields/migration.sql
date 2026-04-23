-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "isBillable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tasks" ADD COLUMN "defaultHourlyRate" DECIMAL(10,2);
