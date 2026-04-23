-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'CONTRACTOR');

-- AlterTable
ALTER TABLE "user_organizations" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "jobLabel" TEXT;
