-- 撤销 time_entries 上 dayDate / weekStart / monthStart（改由 approvals 的 period 与 status 管理）
SET timezone = 'UTC';

DROP INDEX IF EXISTS "time_entries_userId_monthStart_idx";
DROP INDEX IF EXISTS "time_entries_userId_weekStart_idx";
DROP INDEX IF EXISTS "time_entries_userId_dayDate_idx";

ALTER TABLE "time_entries" DROP COLUMN IF EXISTS "monthStart";
ALTER TABLE "time_entries" DROP COLUMN IF EXISTS "weekStart";
ALTER TABLE "time_entries" DROP COLUMN IF EXISTS "dayDate";
