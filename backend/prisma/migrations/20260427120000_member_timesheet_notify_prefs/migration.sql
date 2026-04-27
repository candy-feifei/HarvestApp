-- AlterTable
ALTER TABLE "user_organizations" ADD COLUMN "email_notify_managed_people_timesheets" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_organizations" ADD COLUMN "email_notify_managed_project_timesheets" BOOLEAN NOT NULL DEFAULT true;
