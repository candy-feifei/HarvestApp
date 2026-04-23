# HarvestApp 后端（NestJS）

Harvest 大赛复刻用 **NestJS 11** 服务：模块化、**Prisma + PostgreSQL**、**Swagger**、全局校验与统一异常体，与 `frontend` 的 `VITE_API_BASE_URL`（建议 `http://localhost:3000/api`）对齐。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/Nest后端架构说明.md](./docs/Nest后端架构说明.md) | 目录结构、路径与前端对照、环境变量、Prisma、扩展与交付映射 |

## 快速开始

```bash
cd backend
cp .env.example .env   # Windows 可用 copy；再编辑 DATABASE_URL
npm install
npx prisma migrate deploy   # 首次/新库必须：根据 migrations 建表
npx prisma db seed         # 可选：插入 demo@harvest.app 与 Demo Organization
npm run start:dev
```

> 若出现 **`The table public.users does not exist`**，说明尚未执行上面的 **`migrate deploy`**（或连到了空库/错库）。

- **Swagger**：启动后访问 `http://localhost:3000/api/docs`
- **健康检查**：`GET http://localhost:3000/api/health`（无需 JWT）
- **演示登录**：`POST http://localhost:3000/api/auth/login`，body：`{"email":"demo@harvest.app","password":"demo123"}`，响应中的 `access_token` 作为 `Authorization: Bearer ...` 访问受保护接口（与 `.env.example` 中 `AUTH_*` 一致）

## 常用脚本

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
npm run prisma:generate
npm run prisma:studio
```

**开发模式说明：** `npm run start:dev` 使用 `tsc --watch` + `node --watch`（避免在 Windows 上 `nest start --watch` 通过 `taskkill` 结束子进程时偶发「进程已不存在」而崩溃）。若仍想使用 Nest CLI 内置监听，可运行 `npm run start:dev:nest`。

---

基于 [Nest](https://github.com/nestjs/nest) 官方脚手架演进；更多框架能力见 [NestJS 文档](https://docs.nestjs.com)。
