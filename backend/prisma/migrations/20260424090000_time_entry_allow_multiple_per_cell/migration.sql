-- 允许同一用户、同一 projectTask、同一自然日多条工时（在应用层校验单日合计 ≤ 24h）
DROP INDEX IF EXISTS "time_entries_userId_projectTaskId_spentDate_key";
CREATE INDEX IF NOT EXISTS "time_entries_userId_spentDate_idx" ON "time_entries"("userId", "spentDate");
