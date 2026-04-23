-- Enums for Approvals UI (ReportPeriod, ApprovalsGroupBy)
CREATE TYPE "ReportPeriod" AS ENUM ('DAY', 'WEEK', 'SEMIMONTH', 'MONTH', 'QUARTER', 'CUSTOM');
CREATE TYPE "ApprovalsGroupBy" AS ENUM ('PERSON', 'PROJECT', 'CLIENT');
