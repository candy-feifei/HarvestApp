# Backend module unit testing
_Exported on 2026/5/1 at GMT+8 0:22:30 from Cursor (3.1.14)_

---

**User**

@backend 现在后端单元测试只做了 tasks 模块，需要对其他模块的基本功能也加上单元测试，可以先只覆盖每个模块的基本功能

---

**Cursor**

分析后端模块结构与 tasks 模块的单元测试模式，并为其他模块添加基本单元测试。



正在创建各模块的 `*.spec.ts`，采用与 `tasks` 相同的 Jest + Prisma mock 模式。



已为除 **tasks** 以外的多个后端模块补上与现有约定一致的单元测试（`src/modules/**/**.service.spec.ts`，Prisma 浅 mock、不连库），并已在本机跑通 `npm test`（10 个 suite、19 个用例全部通过）。

## 新增文件与覆盖点

| 模块 | 文件 | 覆盖的基本行为 |
|------|------|----------------|
| **clients** | `clients.service.spec.ts` | `list` 的 `where`（`organizationId` / `isArchived`）；`create` 在 NET_DAYS 缺天数、非 NET_DAYS 却带 `invoiceNetDays` 时抛 `BadRequestException` |
| **health** | `health.service.spec.ts` | `getStatus`：`$queryRaw` 成功/失败时 `database` 与 `status` |
| **expenses** | `expenses.service.spec.ts` | `getFormOptions` 合并项目、分类与 `defaultCurrency` |
| **projects** | `projects.service.spec.ts` | `getById` 在无项目时抛 `NotFoundException`，并校验 `getActiveMembership` 与 `findFirst` 条件 |
| **approvals** | `approvals.service.spec.ts` | `requireApprover`：成员被拒、管理员通过 |
| **reports** | `reports.service.spec.ts` | `getTimeReport` 日期区间非法；`getReportFilters` 四类 Prisma 查询与返回结构 |
| **time-entries** | `time-entries.service.spec.ts` | `list` 同时传 `week`+`month` 抛错；`listAssignableRows` 普通成员的 `where.assignments` |
| **organization** | `organization.service.spec.ts` | `listMembers` 映射与费率字段 |
| **auth** | `auth.service.spec.ts` | `register` 在 `AUTH_ALLOW_REGISTRATION=false` 时抛 `ForbiddenException`；`login` 用户不存在时抛 `UnauthorizedException` 并写 `loginAttempt` |

未单独加 spec 的模块：**settings**、**uploads**、**access** 目前主要是 Controller / 路由层，没有对应的 `*.service.ts`；若你希望连「控制器 + Guard」也算进单测，可以再加 Supertest 的 e2e 或 `*.controller.spec.ts`。

运行全部单测：

```bash
cd F:/AI/code/HarvestApp/backend
npm test
```

---

**User**

需要生成一份单元测试报告，backend/docs/单元测试说明.md 文件不要改，生成一份新的单元测试报告，报告中也要包含 单元测试说明 中与有关的技术栈，脚本，目录与文件约定，mok策略（这个简单说一下），再加上详细的测试报告，另外是否能生成 word 格式？如果可以直接生成 word 文档，不能的话就还是 md 文档

---

**Cursor**

正在读取 `单元测试说明.md`、收集测试结果并生成报告；尝试将报告转为 Word（`.docx`）。



正在生成完整的 `单元测试报告.md`，并删除临时 JSON 文件。



## 已完成

- **新建** `F:/AI/code/HarvestApp/backend/docs/单元测试报告.md`，**未改动** `单元测试说明.md`。
- 报告内包含：
  - **技术栈**、**npm 脚本**、**目录与文件约定**（与《单元测试说明》对齐的摘录，并指向原文）
  - **Mock 策略**（简短一节）
  - **详细测试报告**：执行摘要、全量覆盖率摘要、`npm test` 下 **10 个套件 / 19 条用例** 的分文件表格（含每条用例的简述）
  - **未覆盖模块**（settings / uploads / access）说明
  - **相关文件索引**

## Word（.docx）

当前环境**没有 Pandoc**，项目里也**没有**用于在仓库内直接生成 `.docx` 的依赖，因此**没有生成二进制 `.docx` 文件**。

报告第 1 节已写明两种可行做法：

1. 用 **Microsoft Word** 打开 `单元测试报告.md` → 另存为 **`.docx`**  
2. 安装 **Pandoc** 后执行：  
   `pandoc 单元测试报告.md -o 单元测试报告.docx`（在 `backend/docs/` 下执行）

若你希望**仓库内一键出 docx**（例如在 CI 里），可以再单独加脚本 + 依赖（如 Pandoc 或 `docx` 包），需要的话我可以按你偏好的方式改一版 `package.json` 脚本。

---

**User**

把这个 单元测试报告 中提到 单元测试说明 的文字去掉，并去掉第一节 1. 关于 Word（.docx）格式

---

**Cursor**

正在更新报告：删除第一节、移除所有提及「单元测试说明」的表述，并重新编号各节。



已按你的要求改好 `backend/docs/单元测试报告.md`，具体如下：

1. **整节删除**：原「1. 关于 Word（.docx）格式」及前后分隔线已去掉。  
2. **去掉所有与「单元测试说明」相关的表述**，包括：  
   - 文首「不修改《单元测试说明》…」  
   - 各节标题里的「（与《单元测试说明》一致）」  
   - 目录约定里「见同目录下的单元测试说明.md…」整段  
   - 覆盖率里「详见《单元测试说明》第 6.1 节」→ 改为直接说明 `test:cov:tasks` 与 `collectCoverageFrom` 行为  
   - 「相关文件索引」里指向 `单元测试说明.md` 的那一行  
3. **章节顺延重编号**：原 2～10 节现为 **1～9** 节；原 8.x 小节现为 **7.1～7.10**。  
4. 文末同步改为「人工更新**第 5、6、7 节**…」。

---

**User**

@frontend 同样前端目前单元测试也只有task，参考后端也需要生成前端其他模块，覆盖每个模块基本功能，并生成一个类似后端的新的 单元测试报告 文档

---

**Cursor**

分析前端测试配置、tasks 模块测试模式及各模块结构，以便添加其他模块的基本单测并生成报告。



正在为各 feature 添加 `api.test.ts`（常量模块仅测导出），并生成 `docs/单元测试报告.md`。采用与 `tasks/api.test.ts` 相同的 `vi.mock('@/lib/api/http')` 模式。



正在创建 `frontend/docs/单元测试报告.md`。



## 已完成内容

### 1. 新增各模块基础单测（`vi.mock('@/lib/api/http')`，与 `tasks/api.test.ts` 同套路）

| 文件 | 覆盖要点 |
|------|----------|
| `src/features/clients/api.test.ts` | `listClients`（无/有 `q`）、`fetchClient` |
| `src/features/projects/api.test.ts` | `projectsResourcePath`、`getProjects` 默认分页、`getProject` |
| `src/features/time/api.test.ts` | `timeEntriesResourcePath`、`listAssignableTimeRows`、`listTimeEntries({ week })`、**纯函数** `groupAssignableRowsToTrackProjects` |
| `src/features/expenses/api.test.ts` | `fetchExpenseFormOptions`、`listExpenses`（含 `includeAllMembers` 等） |
| `src/features/reports/api.test.ts` | `reportsBasePath`、`fetchReportFilters`（`X-Organization-Id`）、`fetchTimeReport` 查询串 |
| `src/features/auth/api.test.ts` | `loginRequest`、`forgotPasswordRequest` |
| `src/features/team/api.test.ts` | `listTeamMembers` |
| `src/features/approvals/api.test.ts` | `fetchApprovalsMeta`（无组织 / 有组织头） |
| `src/features/organization/api.test.ts` | 常量 `organizationResourcePath` |
| `src/features/dashboard/api.test.ts` | 常量 `dashboardResourcePath` |
| `src/features/settings/api.test.ts` | 常量 `settingsResourcePath` |
| `src/features/access/api.test.ts` | 常量 `rolesResourcePath` |

原有 **tasks** 的 `api.test.ts`、`tasks-page.test.tsx` 未改。

### 2. 新建报告

- **`frontend/docs/单元测试报告.md`**：结构对齐后端报告（技术栈、脚本、目录约定、Mock 简述、执行摘要、覆盖率摘要、分文件用例表、索引）；**未**改动 `frontend/docs/单元测试说明.md`。

### 3. 验证

- `npm run test:run`：**14** 个测试文件、**27** 条用例全部通过。

本地复查可执行：

```bash
cd F:/AI/code/HarvestApp/frontend
npm run test:run
npm run test:coverage
```

---

**User**

@backend后端代码的 e2e 测试目前也只有 tasks 模块的，也需要参考上面的后端单元测试，生成其他模块的 e2e 测试，覆盖每个模块的基本功能，并生成一个新的 E2E端对端测试报告

---

**Cursor**

分析后端 e2e 现有结构与各模块路由，以便扩展 e2e 并生成报告。



正在扩展 `e2e-prisma-mock.ts`，并在 `app.e2e-spec.ts` 中新增各模块的基本 E2E 用例。



正在创建 `backend/docs/E2E端对端测试报告.md`。



## 已完成

### 1. 扩展 `test/e2e-prisma-mock.ts`
为各模块在 **不连库** 前提下补全/区分 Prisma 行为，主要包括：
- **`client.findMany`**：返回示例客户 `client-e2e-1`（供 Clients、Reports、Approvals filters 等）
- **`project.findMany`**：按 `orderBy` / `include` 分支——**分页列表**（`updatedAt` + 客户 `invoiceDueMode`）仍返回 `[]`，保持原有 **`GET /api/projects`** 断言；**track-time-options**、**expenses / reports / approvals** 等场景返回带 `client`、`projectTasks` 或 `assignments` 的占位项目
- **`projectTask.findMany`**：可填报行
- **`userOrganization.findMany`**：成员列表、报表/审批筛选项
- **`timeEntry` / `approval`**：`list` 周视图与审批窗口查询
- **`expense.findMany`、expenseCategory、role** 等

### 2. 扩展 `test/app.e2e-spec.ts`
在保留原有健康、登录、Projects、**Tasks** 全套用例的基础上，新增 **14** 条用例，覆盖：
- **Organization**：`context`、`members`、`roles`
- **Clients**：`GET /api/clients`
- **Time entries**：`assignable-rows`、`track-time-options`、`GET /api/time-entries?week=…`
- **Expenses**：`form-options`、`GET /api/expenses`
- **Reports**：`GET /api/reports/filters`
- **Approvals**：`meta`、`filters`（管理员身份满足 `requireApprover`）
- **Settings**：`GET /api/settings`
- **Access**：`GET /api/roles`

当前 **`npm run test:e2e`**：**21** 条用例全部通过。

### 3. 新建报告文档
- **`backend/docs/E2E端对端测试报告.md`**：含技术栈与命令、目录与装配、Mock 要点、登录约定、执行摘要、**按模块的用例表**、未覆盖项说明、相关文件索引。  
- **未修改** `E2E端对端测试说明.md`（通用说明仍以该文件为准；具体用例列表以新报告为准）。

### 4. 有意未纳入的「基本」边界
- **`GET /api/projects/:id`**、工时报表 **`/reports/time`**、费用 **`multipart` uploads** 等依赖更重 mock 或二进制上传，放在报告第 7 节「可后续扩展」中说明。

本地验证：

```bash
cd F:/AI/code/HarvestApp/backend
npm run test:e2e
```

