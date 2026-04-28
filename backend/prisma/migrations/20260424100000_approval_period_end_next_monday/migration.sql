-- 与工时周区间 [周一 0:00 UTC, 次周周一 0:00) 对齐：将「周日 0:00」的 periodEnd 进位为「次周周一 0:00」。
-- 新代码写入的 periodEnd 已为次周一；本迁移仅处理旧行（periodEnd = periodStart + 6 个日历日 0:00 的情形）。
UPDATE "approvals"
SET "periodEnd" = "periodEnd" + interval '1 day'
WHERE "periodEnd" = "periodStart" + interval '6 days';
