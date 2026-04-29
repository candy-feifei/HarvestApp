/*
  Warnings:

  - You are about to drop the column `endsOn` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceDiscountPercent` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceDueMode` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceNetDays` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoicePoNumber` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceSecondTaxEnabled` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceSecondTaxPercent` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceTaxPercent` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `isPinned` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `startsOn` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `time_entries` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `time_entries` table. All the data in the column will be lost.
  - You are about to drop the column `assignAllFutureProjects` on the `user_organizations` table. All the data in the column will be lost.
  - You are about to drop the column `managerPermissions` on the `user_organizations` table. All the data in the column will be lost.
  - You are about to drop the `time_entry_timers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "time_entry_timers" DROP CONSTRAINT "time_entry_timers_approvalId_fkey";

-- DropForeignKey
ALTER TABLE "time_entry_timers" DROP CONSTRAINT "time_entry_timers_projectTaskId_fkey";

-- DropForeignKey
ALTER TABLE "time_entry_timers" DROP CONSTRAINT "time_entry_timers_userId_fkey";

-- DropIndex
DROP INDEX "time_entries_userId_spentDate_idx";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "endsOn",
DROP COLUMN "invoiceDiscountPercent",
DROP COLUMN "invoiceDueMode",
DROP COLUMN "invoiceNetDays",
DROP COLUMN "invoicePoNumber",
DROP COLUMN "invoiceSecondTaxEnabled",
DROP COLUMN "invoiceSecondTaxPercent",
DROP COLUMN "invoiceTaxPercent",
DROP COLUMN "isPinned",
DROP COLUMN "metadata",
DROP COLUMN "notes",
DROP COLUMN "startsOn";

-- AlterTable
ALTER TABLE "time_entries" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "user_organizations" DROP COLUMN "assignAllFutureProjects",
DROP COLUMN "managerPermissions";

-- DropTable
DROP TABLE "time_entry_timers";

-- DropEnum
DROP TYPE "ApprovalsGroupBy";

-- DropEnum
DROP TYPE "ReportPeriod";

-- DropEnum
DROP TYPE "TimerStatus";
