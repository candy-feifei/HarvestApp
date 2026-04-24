-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "time_entries" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_userId_projectTaskId_spentDate_key" ON "time_entries"("userId", "projectTaskId", "spentDate");
