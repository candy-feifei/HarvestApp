# HarvestApp · NestJS 后端架构说明

本文描述 `backend/` 的**成熟骨架**约定：与大赛 Harvest 核心模块对齐、便于与前端 `features/*` 及 `VITE_API_BASE_URL` 联调，并支撑后续 PRD 迭代与单测 / e2e。

---

## 1. 技术栈与职责

| 组件 | 说明 |
|------|------|
| NestJS 11 | 模块化、依赖注入、与 Swagger / 校验生态一致 |
| `@nestjs/config` | 环境变量加载与启动校验 |
| `class-validator` + `class-transformer` | `ConfigModule.validate` 与 DTO 校验（DTO 随业务补充） |
| `@nestjs/swagger` | OpenAPI，路径 **`/api/docs`**（与全局前缀组合后见下文） |
| `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | JWT 签发与校验 |
| Prisma + PostgreSQL | ORM 与迁移；当前 `schema.prisma` 含 **User**、**Project** 最小模型，可按领域扩展 |
| 全局 `ValidationPipe` | `whitelist` + `transform` + `forbidNonWhitelisted`，减少无效字段渗透 |
| 全局 `JwtAuthGuard` | 默认所有路由需 Bearer JWT；`@Public()` 放行 |
| `AllExceptionsFilter` | 统一错误 JSON，对齐前端 `apiRequest` 对 `message` / `statusCode` 的解析习惯 |

---

## 2. 请求路径与前端约定

- **全局前缀**：`api`（在 `main.ts` 中 `setGlobalPrefix('api')`）。
- **实际 URL 示例**：`GET http://localhost:3000/api/health`。
- **Swagger UI**：`http://localhost:3000/api/docs`（Nest 将 `setup('docs')` 挂到全局前缀下）。
- **前端环境变量**：请将前端的 `VITE_API_BASE_URL` 设为 **`http://localhost:3000/api`**（末尾无 `/`），与 `frontend/src/lib/api/http.ts` 的路径拼接规则一致。

### 2.1 与前端 `features/*/api.ts` 资源路径对照

| 领域 | HTTP 路径（相对 `/api`） | Nest 模块 |
|------|---------------------------|-----------|
| 健康检查 | `GET /health`（`@Public()`） | `HealthModule` |
| 演示登录 | `POST /auth/login`（`@Public()`） | `AuthModule` |
| 用户与组织（分页） | `GET /organizations`（需 JWT） | `OrganizationModule` |
| 项目（分页 + `@CurrentUser()` 样板） | `GET /projects`（需 JWT） | `ProjectsModule` |
| 任务 | `GET /tasks` | `TasksModule`（占位 JSON） |
| 时间记录 | `GET /time-entries` | `TimeEntriesModule`（占位） |
| 报表 | `GET /reports` | `ReportsModule`（占位） |
| 发票/费用 | `GET /expenses` | `ExpensesModule`（占位） |
| 权限与角色 | `GET /roles` | `AccessModule`（占位） |
| 基础设置 | `GET /settings` | `SettingsModule`（占位） |
| 认证 | `POST /auth/login` 等 | `AuthModule`（JWT 签发；策略见 `JwtStrategy`） |

---

## 3. JWT 与 `@Public()`

- **全局守卫**：`AppModule` 注册 `APP_GUARD` → `JwtAuthGuard`。未标 `@Public()` 的接口默认要求请求头：`Authorization: Bearer <access_token>`。
- **公开路由**：
  - 使用装饰器 **`@Public()`**（定义在 `src/common/decorators/public.decorator.ts`，元数据键 `IS_PUBLIC_KEY`）。
  - 已标注：`HealthController`、`AuthController`（整类）。
- **Swagger UI**：由框架注册的路由无法挂装饰器，`JwtAuthGuard` 内对 **`path` 含 `/docs`** 的请求放行（生产建议由网关保护文档或关闭）。
- **演示登录**：`POST /api/auth/login`，body JSON：`{ "email": "demo@harvest.app", "password": "demo123" }`（可通过环境变量 `AUTH_DEMO_EMAIL` / `AUTH_DEMO_PASSWORD` 修改）。返回 `access_token`、`token_type`、`expires_in`（秒）。
- **密钥与过期**：`JWT_SECRET`（生产必填强随机）、`JWT_EXPIRES_IN`（如 `7d` / `12h`，内部会换算为**秒**写入 JWT，避免类型不兼容）。
- **当前用户**：`@CurrentUser()` 从 `request.user` 取 `{ userId, email }`（由 `JwtStrategy.validate` 注入）。

生产环境请替换演示登录为 **数据库用户 + bcrypt** 等方案，并收紧 Swagger 暴露策略。

---

## 4. 分页规范（DTO + 响应形状）

- **查询 DTO**：`PaginationQueryDto`（`src/common/dto/pagination-query.dto.ts`），Query 参数 **`page`**、**`pageSize`**（1～100，缺省回退为 1 / 20）。
- **工具方法**：`getSkipTake`、`toPaginatedResult`、`buildPageMeta`（`src/common/utils/pagination.util.ts`）。
- **列表响应形状**：

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

- **已接入分页的接口**：`GET /api/organizations`、`GET /api/projects`（其余占位接口后续可按同一模式扩展）。

---

## 5. 源码目录结构

```
backend/src/
  main.ts                      # 全局前缀、CORS、Pipe、Swagger、监听端口
  app.module.ts                # 组装 Config、Prisma、各领域模块、APP_GUARD

  config/
    env.validation.ts            # 启动时环境变量校验（class-validator）
    jwt.config.ts                # JWT 密钥解析、时长字符串 → 秒

  prisma/
    prisma.module.ts           # @Global() 导出 PrismaService
    prisma.service.ts          # 生命周期内连接 / 断开

  common/
    constants/
      auth.constants.ts        # IS_PUBLIC_KEY
    decorators/
      public.decorator.ts      # @Public()
      current-user.decorator.ts
    dto/
      pagination-query.dto.ts
    filters/
      all-exceptions.filter.ts # 全局异常过滤器
    utils/
      pagination.util.ts

  types/
    express.d.ts               # Express.User 与 JWT payload 对齐

  modules/
    auth/                      # JWT、登录、JwtStrategy、JwtAuthGuard
    health/                    # 健康检查 + DB 探测
    organization/              # 用户列表（Prisma User）
    projects/                  # 项目列表（Prisma Project + owner）
    tasks/
    time-entries/
    reports/
    expenses/
    access/                    # 路由前缀 roles
    settings/
```

Prisma schema 位于 **`backend/prisma/schema.prisma`**。

---

## 6. 环境与数据库

1. 复制 **`backend/.env.example`** 为 **`.env`**，填写真实 `DATABASE_URL`。
2. 首次建表（开发机快速同步 schema，无迁移文件时）：

   ```bash
   cd backend
   npx prisma db push
   ```

3. 需要**可重复迁移历史**时，使用：

   ```bash
   npx prisma migrate dev --name init
   ```

4. **Prisma Client** 在 `npm install` 后通过 **`postinstall: prisma generate`** 生成；若 CI 禁 postinstall，请显式执行 `npm run prisma:generate`。

---

## 7. 常用命令

```bash
cd backend
npm install
npm run start:dev        # 热重载
npm run build
npm run lint
npm run test             # 单元测试
npm run test:e2e         # e2e：健康检查 + 登录后访问 /api/projects（Prisma mock）
npm run prisma:studio    # 可视化管理数据
```

---

## 8. 扩展指南（按大赛模块推进）

1. **新增领域**：在 `src/modules/<name>/` 增加 `*.module.ts`、controller、service；在 `AppModule` 的 `imports` 注册。
2. **DTO 与校验**：为 body/query 建 `*.dto.ts`；列表统一使用 **`PaginationQueryDto`** + `toPaginatedResult`。
3. **OpenAPI**：受保护接口在 controller 类上加 **`@ApiBearerAuth()`**；DTO 使用 `@ApiProperty` / `@ApiPropertyOptional`。
4. **公开接口**：在 handler 或 controller 类上使用 **`@Public()`**；勿在业务接口上滥用。
5. **与前端契约**：优先以 Swagger 为单一事实来源；可选 `openapi-typescript` 生成前端类型（另见技术设计文档）。

---

## 9. 错误响应约定

非 2xx 时，全局过滤器会尽量输出包含 **`statusCode`**、**`message`**（或校验错误结构）、**`path`** 的 JSON，便于前端统一处理与日志上报。

---

## 10. 与大赛交付物的映射

| 大赛关注点 | 本仓库对应做法 |
|------------|----------------|
| 技术设计 / 模块划分 | 每个 `modules/*` 对应 Harvest 子域；`AuthModule` 预留 |
| 工程质量 | 全局 Pipe + Filter；分层 controller / service；ESLint |
| 单测 / e2e | Jest + Supertest；e2e 覆盖 `/api/health` 与 **登录 → 带 JWT 访问 `/api/projects`** |
| 接口说明 | Swagger `/api/docs`；可导出 OpenAPI JSON 附在材料中 |

---

文档维护：变更全局前缀、数据库策略或模块边界时，请同步更新本文与 `backend/README.md`。
