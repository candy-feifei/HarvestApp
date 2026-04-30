# HarvestApp · 后端 E2E（端对端）测试报告

**生成日期**：2026-04-30  
**范围**：`backend/test/` 下 `*.e2e-spec.ts`，Jest 配置为 `test/jest-e2e.json`；HTTP 前缀 **`/api`**，Prisma 使用 **`createE2ePrismaMock()`** 覆盖，**不连接真实 PostgreSQL**。

---

## 1. 技术栈与运行方式

| 组件 | 说明 |
|------|------|
| **Jest** | E2E 运行器（配置独立于 `src/**/*.spec.ts` 的单元测） |
| **Supertest** | 对 `INestApplication` 发起真实 HTTP |
| **@nestjs/testing** | `Test.createTestingModule`，`overrideProvider(PrismaService)` |
| **bcrypt** | 登录校验与 `e2e-prisma-mock.ts` 中 `DEMO_PASSWORD_HASH` 一致 |

| 命令 | 作用 |
|------|------|
| `cd backend` 后 **`npm run test:e2e`** | 执行全部 E2E（`jest --config ./test/jest-e2e.json`） |

**本地前提**：已 `npm install`；`JWT_SECRET` 在用例 `beforeEach` 中设为 `e2e-test-secret`。

---

## 2. 目录与装配约定

| 路径 | 作用 |
|------|------|
| `test/jest-e2e.json` | `testRegex`：`.e2e-spec.ts$` |
| `test/app.e2e-spec.ts` | 主 E2E 套件（健康、登录、各模块基本路由） |
| `test/e2e-prisma-mock.ts` | `createE2ePrismaMock()`、`E2E_USER_ID`、`E2E_ORG_ID`、`DEMO_PASSWORD_HASH` |

装配要点：`AppModule` + 全局前缀 `api` + 与主应用一致的 **`ValidationPipe`**（`whitelist`、`transform`、`forbidNonWhitelisted`）。

---

## 3. Prisma Mock 策略（简述）

- 在 E2E 中 **`PrismaService` 整体替换**为内存/ `jest.fn` 实现，满足登录链（`user` / `userOrganization.findFirst`）、**Tasks** 内存表 `taskRows`、以及各模块列表接口所需的 **`client` / `project` / `projectTask` / `timeEntry` / `approval` / `expense` / `expenseCategory` / `role` 等**。
- **`$queryRaw` / `$transaction`** 做简化实现，保证健康检查与 Tasks 删除事务等路径不报未定义。
- 新增路由时若出现 **500** 与 Prisma 相关，优先在 **`e2e-prisma-mock.ts`** 补全对应 `delegate.method`。

---

## 4. 登录约定（固定账号）

| 项 | 值 |
|----|-----|
| 请求 | `POST /api/auth/login` |
| body | `{ "email": "demo@harvest.app", "password": "demo123" }` |
| 后续请求头 | `Authorization: Bearer <access_token>` |

---

## 5. 本次执行摘要

| 指标 | 结果（报告撰写时） |
|------|-------------------|
| 命令 | `npm run test:e2e` |
| 套件 | **1** 个（`app.e2e-spec.ts`），**全部通过** |
| 用例 | **21** 条，**全部通过** |
| 快照 | **0** |

---

## 6. 用例明细（按模块）

### 6.1 全局与健康

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 1 | 健康检查无需令牌 | `GET /api/health` | 200，`status: ok`，`database: true`（mock `$queryRaw`） |
| 2 | 登录后可访问项目分页 | `POST /api/auth/login` → `GET /api/projects` | 200 / 200，`meta.page`、`data` 存在 |

### 6.2 Tasks（任务）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 3 | 列表分区 common / other | `GET /api/tasks` | 200，含预置 `task-common-1`、`task-other-1` |
| 4 | 单条详情 | `GET /api/tasks/task-common-1` | 200 |
| 5 | 创建、更新、归档、批量归档 | `POST` / `PATCH` / `POST …/archive` / `POST …/batch/archive` | 201 / 200 / 201 / 201 |
| 6 | 删除无工时任务 | `DELETE /api/tasks/:id` | 200，`deleted: true` |
| 7 | 导出 JSON | `GET /api/tasks/export?format=json` | 200，附件式 JSON，`version: 1` |

### 6.3 Organization（组织）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 8 | 当前组织上下文 | `GET /api/organizations/context` | 200，`organizationId`、`organization.defaultCurrency` |
| 9 | 成员列表 | `GET /api/organizations/members` | 200，`items` 非空，含 demo 用户 |
| 10 | 组织角色列表 | `GET /api/organizations/roles` | 200，含预置 `role-e2e-1` |

### 6.4 Clients（客户）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 11 | 客户列表 | `GET /api/clients` | 200，`items` 含 `client-e2e-1` |

### 6.5 Time entries（工时）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 12 | 可填报行 | `GET /api/time-entries/assignable-rows` | 200，`rows` 含 `pt-e2e-1` |
| 13 | Track time 选项 | `GET /api/time-entries/track-time-options` | 200，`projects` 非空且含 `tasks` |
| 14 | 按周查询工时 | `GET /api/time-entries?week=2026-04-06` | 200，`mode: week`，`items` 为数组 |

### 6.6 Expenses（费用）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 15 | 表单选项 | `GET /api/expenses/form-options` | 200，`projects`、`categories`（含 `cat-e2e-1`）、`defaultCurrency` |
| 16 | 费用列表 | `GET /api/expenses` | 200，`items` 为数组 |

### 6.7 Reports（报表）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 17 | 报表筛选项 | `GET /api/reports/filters` | 200，`currency`、`clients`、`projects`、`tasks` 均为合理结构 |

### 6.8 Approvals（审批）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 18 | 元数据枚举 | `GET /api/approvals/meta` | 200，`groupBy`、`entryStatus` 等数组 |
| 19 | 审批筛选项 | `GET /api/approvals/filters` | 200，需审批角色；`teammates` 非空 |

### 6.9 Settings & Access（设置与权限占位）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 20 | 设置占位 | `GET /api/settings` | 200，`module: settings` |
| 21 | 角色占位 | `GET /api/roles` | 200，`module: access`，`items: []` |

---

## 7. 未在本套件覆盖的说明（可后续扩展）

| 方向 | 说明 |
|------|------|
| **Projects 详情** | `GET /api/projects/:id` 依赖聚合查询与更完整 `project`/`timeEntry` mock，未纳入本次「基本功能」 |
| **Clients 写操作** | `POST/PATCH/DELETE` 客户与联系人未加 E2E，可在 mock 中补 `client` 写路径后增加 |
| **报表 time / profitability** | 依赖大量 `timeEntry` 与原始 SQL，本次仅覆盖 **`/api/reports/filters`** |
| **Uploads** | 多为 `multipart/form-data`，需单独设计用例 |
| **Account** | 如 `POST /api/account/change-password` 未覆盖 |

---

## 8. 相关文件索引

| 文件 | 说明 |
|------|------|
| `backend/docs/E2E端对端测试报告.md` | 本报告 |
| `backend/test/app.e2e-spec.ts` | E2E 用例源码 |
| `backend/test/e2e-prisma-mock.ts` | Prisma 假实现 |
| `backend/test/jest-e2e.json` | Jest E2E 配置 |

---

*CI 或发版前可执行 `npm run test:e2e` 后更新第 5、6 节中的统计与表格以保持同步。*
