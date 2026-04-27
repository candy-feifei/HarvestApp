-- 新成员默认系统角色改为 Administrator（与 schema 一致）
ALTER TABLE "user_organizations" ALTER COLUMN "systemRole" SET DEFAULT 'ADMINISTRATOR'::"SystemRole";
