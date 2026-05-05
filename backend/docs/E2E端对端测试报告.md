# HarvestApp · 后端 E2E（端对端）测试报告

**生成日期**：2026-05-05  
**范围**：`backend/test/` 下 `*.e2e-spec.ts`（当前为 `app.e2e-spec.ts`），Jest 配置为 **`test/jest-e2e.json`**；HTTP 全局前缀 **`/api`**；**`PrismaService` 由 `createE2ePrismaMock()` 替换，不连接真实 PostgreSQL**。

---

## 文档概述

本报告说明后端 **API 级 E2E** 的定位、配置、目录结构、一次执行结果与用例明细。此类测试在进程内启动 **完整 Nest `AppModule`**，经 **Supertest** 走真实路由、管道、Guard 与 Service 调用链，用于回归 **鉴权、校验与多模块联调**。

**与「覆盖率」的关系**：

| 含义 | 说明 |
|------|------|
| **场景 / 路由覆盖** | 本文以 **用例条数** 与 **HTTP 路径** 为主（当前 **29** 条），表示有多少业务入口被黑盒断言。 |
| **代码行覆盖（可选）** | 在 `jest-e2e.json` 中已配置 `collectCoverageFrom`；执行 `npx jest --config ./test/jest-e2e.json --coverage` 可在 `backend/coverage-e2e/` 生成报告。下文「覆盖率摘要」为报告更新时的一次采样。 |

**与前端 E2E 的边界**：本套件 **不包含浏览器**；若需 UI 级验收，见仓库 `frontend/e2e/`（Playwright）及对应 E2E 文档。

**与 `E2E端对端测试说明.md` 的关系**：说明文档侧重 **日常扩展 mock、登录约定、排错**；本报告侧重 **配置逐项解释、执行数据、用例表与维护索引**。

---

## 1. 技术栈与运行方式

| 组件 | 说明 |
|------|------|
| **Jest** | E2E 运行器；配置与 `src/**/*.spec.ts` 单元测 **隔离** |
| **Supertest** | 对 `INestApplication` 发起 HTTP |
| **@nestjs/testing** | `Test.createTestingModule`，`overrideProvider(PrismaService)` |
| **bcrypt** | 真实校验；`e2e-prisma-mock.ts` 中 **`DEMO_PASSWORD_HASH`** 须与密码 **`demo123`** 一致 |

| 命令 | 作用 |
|------|------|
| `cd backend` 后 **`npm run test:e2e`** | 执行全部 E2E（`jest --config ./test/jest-e2e.json`） |
| **`npx jest --config ./test/jest-e2e.json --coverage`** | 同上并生成 **代码覆盖率**（`coverage-e2e/`，较慢） |

**本地前提**：已 `npm install`；`JWT_SECRET` 在用例 `beforeEach` 中设为 **`e2e-test-secret`**，与测试模块内 `JwtService` 一致。

---

## 2. 配置说明（`test/jest-e2e.json`）

| 字段 | 当前值 | 含义 |
|------|--------|------|
| **`rootDir`** | **`..`**（即 `backend` 仓库根） | 便于 `collectCoverageFrom` 使用 `src/**/*.ts` |
| **`testRegex`** | **`\\.e2e-spec\\.ts$`** | 匹配任意子目录下的 `*.e2e-spec.ts` |
| **`testPathIgnorePatterns`** | `node_modules`、`dist` | 避免误扫构建产物 |
| **`testEnvironment`** | `node` | 无浏览器 DOM |
| **`transform`** | `ts-jest` | TypeScript 编译 |
| **`collectCoverageFrom`** | `src/**/*.ts`（排除 `*.spec.ts`、`main.ts`） | 仅在使用 **`--coverage`** 时生效 |
| **`coverageDirectory`** | **`coverage-e2e`**（相对 `backend`） | HTML：`backend/coverage-e2e/lcov-report/index.html`（若使用 `lcov` reporter） |

应用装配（在 `app.e2e-spec.ts` 内，与说明文档一致）：

- `imports: [AppModule]` + **`overrideProvider(PrismaService).useValue(createE2ePrismaMock())`**
- **`app.setGlobalPrefix('api')`**
- 全局 **`ValidationPipe`**：`whitelist`、`transform`、`forbidNonWhitelisted` 与主应用对齐

---

## 3. 项目文件结构（与 E2E 相关）

```
backend/
├── test/
│   ├── jest-e2e.json          # Jest E2E 配置（rootDir、覆盖率等）
│   ├── app.e2e-spec.ts        # 主 E2E 套件（HTTP 场景）
│   └── e2e-prisma-mock.ts     # Prisma 内存 / jest.fn 假实现
├── src/                       # 被测业务代码
├── coverage-e2e/              # 加 --coverage 时生成（已列入 .gitignore）
└── docs/
    ├── E2E端对端测试报告.md   # 本文件
    └── E2E端对端测试说明.md   # 扩展 mock、登录约定、FAQ
```

新 E2E 文件可放在 `test/`（或未来其他目录），文件名须以 **`.e2e-spec.ts`** 结尾以匹配 `testRegex`。

---

## 4. Prisma Mock 策略（摘要）

- **`createE2ePrismaMock()`** 提供登录链（`user` / `userOrganization`）、**Tasks** 内存表 **`taskRows`**、**`project.findFirst`（项目详情）**、**`project.findMany`（含 `where.AND` + `select: { id }` 以支持盈利报表选项目）**、**`client` 的 `findMany` / `findFirst` / `create` / `update`**、以及各列表所需的 **`timeEntry` / `expense` / `approval` / `role`** 等。
- **`$queryRaw`**：统一返回含 **`spent` / `costs`** 的行，以支撑 **健康检查**（不抛错即可）与 **项目详情 / 列表** 中的聚合占位逻辑。
- **`$transaction`**：对数组与函数两种形态做简化转发。
- 新增路由若出现 **500** 且栈在 `prisma.*`，优先在 **`e2e-prisma-mock.ts`** 补全对应 **delegate 方法** 或对 **`E2E_ORG_ID` / `E2E_USER_ID`** 的条件分支。

---

## 5. 登录约定（固定账号）

| 项 | 值 |
|----|-----|
| 请求 | `POST /api/auth/login` |
| body | `{ "email": "demo@harvest.app", "password": "demo123" }` |
| 后续请求头 | `Authorization: Bearer <access_token>` |

修改密码用例在成功后使用 **`NewDemoPass9`** 等新口令；因 **每个用例重新 `createE2ePrismaMock()`**，后续用例仍用 **`demo123`** 登录，互不干扰。

---

## 6. 常见问题排查

| 现象 | 可能原因 | 处理建议 |
|------|----------|----------|
| **401 / 无法登录** | `DEMO_PASSWORD_HASH` 与 `demo123` 不一致 | 用 `bcrypt.hash('demo123', 12)` 重新生成并写回 mock |
| **500 + `Cannot read properties of undefined (reading 'findFirst')'`** | mock 缺少某 `prisma.xxx` 方法 | 在 `e2e-prisma-mock.ts` 补全 delegate |
| **404 组织 / 成员** | `userOrganization.findFirst` 未识别 `X-Organization-Id` 或 `userId` | 检查 `where` 是否与 **`E2E_USER_ID`、ACTIVE** 一致 |
| **校验 400** | DTO 与 `ValidationPipe` 字段不符 | 对照 DTO 必填项调整请求 body |
| **路径 404** | 漏写全局前缀 | 业务 URL 必须以 **`/api`** 开头 |
| **覆盖率 0 或 Unknown** | `rootDir` / `collectCoverageFrom` 路径错误 | 使用当前仓库的 **`rootDir: ".."`** 与 `src/**/*.ts`；必须加 **`--coverage`** |
| **仅跑单个文件** | Jest 30+ CLI | 在 `backend` 下：`npx jest --config ./test/jest-e2e.json --testPathPatterns=app.e2e-spec` |

---

## 7. 本次执行摘要

| 指标 | 结果（报告更新时） |
|------|-------------------|
| 命令 | `npm run test:e2e` |
| 套件 | **1**（`test/app.e2e-spec.ts`），**全部通过** |
| 用例 | **29**，**全部通过** |
| 快照 | **0** |

---

## 8. 代码覆盖率摘要（可选：`--coverage`）

在 **`backend`** 目录执行：

```bash
npx jest --config ./test/jest-e2e.json --coverage --coverageReporters=text-summary
```

报告更新时的一次采样如下（**随源码增长，分母会变化**；数值仅供对比「扩展 E2E 前后」）：

| 维度 | 覆盖 | 总数 | 比例（约） |
|------|------|------|------------|
| Statements | 1334 | 3153 | **42.3%** |
| Branches | 489 | 1850 | **26.4%** |
| Functions | 165 | 538 | **30.7%** |
| Lines | 1229 | 2972 | **41.4%** |

**说明**：E2E 覆盖率表示「启动全应用跑场景时**执行到的语句**」，与单元测 **`npm run test:cov`** 的收集范围可对比，但**不宜简单加总**。HTML 报告目录：**`backend/coverage-e2e/`**。

---

## 9. 用例明细（按模块）

### 9.1 全局与健康 / 认证

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 1 | 健康检查无需令牌 | `GET /api/health` | 200，`status: ok`，`database: true` |
| 2 | 错误密码拒绝登录 | `POST /api/auth/login` | 401 |
| 3 | 登录后可访问项目分页 | `POST /api/auth/login` → `GET /api/projects` | 200 / 200，`meta`、`data` 存在 |
| 4 | 项目详情 | `GET /api/projects/proj-e2e-1` | 200，含 `clientId`、`tasks`、`team` |

### 9.2 Tasks（任务）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 5 | 列表分区 common / other | `GET /api/tasks` | 200，含预置 `task-common-1`、`task-other-1` |
| 6 | 单条详情 | `GET /api/tasks/task-common-1` | 200 |
| 7 | 创建、更新、归档、批量归档 | `POST` / `PATCH` / `POST …/archive` / `POST …/batch/archive` | 201 / 200 / 201 / 201 |
| 8 | 删除无工时任务 | `DELETE /api/tasks/:id` | 200，`deleted: true` |
| 9 | 导出 JSON | `GET /api/tasks/export?format=json` | 200，附件式 JSON，`version: 1` |

### 9.3 Organization（组织）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 10 | 当前组织上下文 | `GET /api/organizations/context` | 200，`organizationId`、`organization.defaultCurrency` |
| 11 | 成员列表 | `GET /api/organizations/members` | 200，`items` 含 demo 用户 |
| 12 | 组织角色列表 | `GET /api/organizations/roles` | 200，含预置 `role-e2e-1` |

### 9.4 Clients（客户）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 13 | 客户列表 | `GET /api/clients` | 200，`items` 含 `client-e2e-1` |
| 14 | 创建客户 | `POST /api/clients` | 201，`resolvedCurrency`、`id` |
| 15 | 客户详情 | `GET /api/clients/client-e2e-1` | 200，`activeProjects`、`projectCount` |
| 16 | 更新客户 | `PATCH /api/clients/client-e2e-1` | 200，名称更新 |

### 9.5 Time entries（工时）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 17 | 可填报行 | `GET /api/time-entries/assignable-rows` | 200，`rows` 含 `pt-e2e-1` |
| 18 | Track time 选项 | `GET /api/time-entries/track-time-options` | 200，`projects` 非空且含 `tasks` |
| 19 | 按周查询工时 | `GET /api/time-entries?week=2026-04-06` | 200，`mode: week`，`items` 为数组 |

### 9.6 Expenses（费用）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 20 | 表单选项 | `GET /api/expenses/form-options` | 200，`projects`、`categories`、`defaultCurrency` |
| 21 | 费用列表 | `GET /api/expenses` | 200，`items` 为数组 |

### 9.7 Reports（报表）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 22 | 报表筛选项 | `GET /api/reports/filters` | 200，`currency`、`clients`、`projects`、`tasks` |
| 23 | 工时报表 | `GET /api/reports/time?fromYmd&toYmd&groupBy=clients` | 200，`summary`、`rows` |
| 24 | 盈利报表 | `GET /api/reports/profitability?fromYmd&toYmd&groupBy=clients` | 200，`series`、`summary` |

### 9.8 Approvals（审批）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 25 | 元数据枚举 | `GET /api/approvals/meta` | 200，`groupBy`、`entryStatus` |
| 26 | 审批筛选项 | `GET /api/approvals/filters` | 200，`teammates` 非空 |

### 9.9 Account（账户）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 27 | 修改登录密码 | `POST /api/account/change-password` | 200，`changed: true`（真实 `bcrypt` + mock `user.update`） |

### 9.10 Settings & Access（占位）

| # | 用例 | 方法 / 路径 | 期望 |
|---|------|-------------|------|
| 28 | 设置占位 | `GET /api/settings` | 200，`module: settings` |
| 29 | 角色占位 | `GET /api/roles` | 200，`module: access`，`items: []` |

---

## 10. 仍未覆盖或仅轻量覆盖的说明（后续可扩展）

| 方向 | 说明 |
|------|------|
| **真实 PostgreSQL** | 当前为 **无库 E2E**；若需迁移/约束级验收，可另起 job 连接测试库并 **去掉** `PrismaService` override。 |
| **Uploads（multipart）** | 需构造 `multipart/form-data` 与存储 mock。 |
| **Projects POST/PATCH** | 创建/更新项目体量大，可在 mock 中补 `task`/`assignment` 写路径后增加。 |
| **Clients 联系人 / 归档 / 删除** | 需在 mock 中补 `clientContact`、`project.count` 等分支。 |
| **报表带真实工时** | 可在 mock 中为 `timeEntry.findMany` 注入少量行，断言非空 `rows`。 |
| **Auth 注册 / 重置密码** | 依赖邮件与 token 存储，需额外 stub `MailService` 或环境。 |

---

## 11. 相关文件索引

| 文件 | 说明 |
|------|------|
| `backend/docs/E2E端对端测试报告.md` | 本报告 |
| `backend/docs/E2E端对端测试说明.md` | Mock 扩展与维护清单 |
| `backend/test/app.e2e-spec.ts` | E2E 用例源码 |
| `backend/test/e2e-prisma-mock.ts` | Prisma 假实现 |
| `backend/test/jest-e2e.json` | Jest E2E 配置 |
| `backend/coverage-e2e/` | 加 `--coverage` 时的报告目录 |

---

*发版或扩展用例后请执行 `npm run test:e2e`（及可选 `--coverage`），并更新本文第 7、8、9 节中的数字与表格以保持同步。*
