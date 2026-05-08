# ChronaApp

本仓库为 **ChronaApp** 全栈工程：面向 Harvest 大赛主题的业务管理台，**前端** [Vite 6 + React + TypeScript](https://vitejs.dev/)，**后端** [NestJS 11](https://nestjs.com/) + **Prisma** + **PostgreSQL**。根目录 [`docker-compose.yml`](./docker-compose.yml) 可一键拉起数据库、API 与静态前端（Nginx 将浏览器请求 **`/api`** 反代到后端）

## 技术栈摘要

| 层级 | 技术 |
|------|------|
| 前端 | React、TypeScript、Vite 6、Tailwind v4、shadcn/ui |
| 后端 | NestJS、Prisma、PostgreSQL |
| 部署 | Docker Compose（`postgres` + `backend` + `frontend`/Nginx）、生产镜像启动时执行 `prisma migrate deploy` |

## 仓库结构

| 路径 | 说明 |
|------|------|
| [`frontend/`](./frontend/) | 管理台 SPA，详见 [`frontend/README.md`](./frontend/README.md) 与 [`frontend/docs/`](./frontend/docs/) |
| [`backend/`](./backend/) | REST API，详见 [`backend/README.md`](./backend/README.md) 与 [`backend/docs/`](./backend/docs/) |
| [`docker-compose.yml`](./docker-compose.yml) | 本地/演示一键编排（PostgreSQL 暴露主机 `5432`，Web 入口 `8080`） |
| [`prompts/`](./prompts/) | 团队通用 Prompt 模板与 AI 协作约定，见 [`prompts/README.md`](./prompts/README.md) |
| [`docs/`](./docs/) | PRD、测试报告、用户手册等交付与过程材料（Office 等） |
| [`AI/`](./AI/) | 与 AI/技能赛相关的辅助资料与工具 |

## 一键启动（Docker）

在项目根目录执行：

```bash
docker compose up -d --build
```

- **前端**：<http://localhost:8080>（构建参数 `VITE_API_BASE_URL=/api`，由 Nginx 转发）
- **Swagger**：<http://localhost:8080/api/docs>
- **健康检查**（无需 JWT）：`GET http://localhost:8080/api/health`

仅起数据库供本机 Nest/Prisma 使用：

```bash
docker compose up -d postgres
```

默认库名 `harvestapp`，连接串见 `docker-compose.yml` 中 `DATABASE_URL`。生产环境请将 `JWT_SECRET` 等改为强随机值（可通过环境变量或 `.env` 覆盖 compose 中的占位）。

## 本地开发（前后端分跑）

**后端**（首次或新库需迁移，缺表时报 `users does not exist` 多为未执行迁移）：

```bash
cd backend
cp .env.example .env   # Windows 可用 copy；编辑 DATABASE_URL
npm install
npx prisma migrate deploy
npx prisma db seed     # 可选：演示账号等
npm run start:dev
```

- Swagger：<http://localhost:3000/api/docs>
- 演示登录：`POST http://localhost:3000/api/auth/login`，body 示例：`{"email":"demo@harvest.app","password":"demo123"}`（与 seed / `.env.example` 中 `AUTH_*` 一致）

**前端**：

```bash
cd frontend
npm install
npm run dev
```

与 Nest 联调时，在 **`frontend` 目录**下创建 `.env`（`npm run dev` 时工作目录在此；无尾斜杠，与后端全局前缀 `api` 一致）：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

开发服务器已将浏览器请求 **`/api`** 代理到 `VITE_DEV_API_TARGET`（默认 `http://127.0.0.1:3000`），也可将 `VITE_API_BASE_URL` 设为 `/api` 走代理，详见 [`frontend/vite.config.ts`](./frontend/vite.config.ts)。

常用脚本与 Windows 下 `start:dev` 监听说明、调试入口等见各自子项目 README。

## 文档索引

| 文档 | 说明 |
|------|------|
| [`backend/docs/Nest后端架构说明.md`](./backend/docs/Nest后端架构说明.md) | 后端目录、环境变量、Prisma、与前端路径对照 |
| [`frontend/docs/前端搭建说明.md`](./frontend/docs/前端搭建说明.md) | 前端搭建、ESLint、对接 Nest 注意点 |
| [`frontend/docs/目录结构说明.md`](./frontend/docs/目录结构说明.md) | `features` 约定与路由/侧栏对应 |
| [`backend/docs/E2E端对端测试说明.md`](./backend/docs/E2E端对端测试说明.md) | 后端 E2E |
| [`frontend/e2e/E2E-实现与数据说明.md`](./frontend/e2e/E2E-实现与数据说明.md) | 前端 Playwright E2E |
| [`prompts/README.md`](./prompts/README.md) | 团队 Prompt 模板与使用约定 |

## 在线访问

部署环境登录页：<http://118.25.197.181:8080/login>
