# HarvestApp 前端 E2E：技术栈、搭建与数据说明

本文说明当前 **浏览器端 E2E**（以 `e2e/app-journey.spec.ts` 为主）所用技术、如何从零搭建、数据从哪里来，以及如何扩展与排错。

---

## 1. 概述

- **目标**：在真实 Chromium 中模拟用户操作，验证登录、侧栏导航、Tasks 页「新建任务 + 列表行编辑保存」等关键路径。
- **运行位置**：在仓库 **`HarvestApp/frontend`** 目录执行 npm 脚本；一键脚本会协调 **Docker Postgres、后端 Nest、前端 Vite、Playwright**。
- **与单元测试区别**：E2E 走完整网络栈（浏览器 → 前端 → API → 数据库），速度慢、依赖多，但最接近生产行为。

---

## 2. 技术栈

| 层级 | 技术 | 作用 |
|------|------|------|
| 测试框架 | **@playwright/test**（Playwright 1.x） | 浏览器自动化、断言、`request` 夹具、HTML/JUnit 报告 |
| 语言 | **TypeScript** | 用例与 helper 与前端工程一致 |
| 浏览器 | **Chromium**（`npx playwright install chromium`） | `playwright.config.ts` 中 `projects: [Desktop Chrome]` |
| 编排脚本 | **Node.js ESM**（`scripts/e2e-run.mjs`） | 启 Docker、migrate、seed、起后端/前端、再调 `npx playwright test` |
| 前端运行时 | **Vite**（开发服务器，默认 **5174**） | 被测 SPA；E2E 下通过 `VITE_API_BASE_URL` 直连后端 API |
| 后端 | **NestJS** + **Prisma** + **PostgreSQL** | 提供 `/api/health`、登录、Tasks 等业务 API |
| 数据层 | **Prisma seed**（`backend/prisma/seed.js`） | 写入演示用户与组织，供登录与后续 API 使用 |

Playwright 能力摘要：

- **`page`**：导航、`click`、`fill`、`expect` 可见性/URL 等。
- **`request`**：`APIRequestContext`，本项目中用于轮询 **`GET /api/health`**，直到后端就绪。
- **`test.step`**：在报告/UI 里拆步骤名（如 `Sidebar → team`）。
- **`baseURL`**：`page.goto('/login')` 等相对路径会拼到 `http://localhost:5174`（可环境变量覆盖）。

---

## 3. 目录与文件职责

```
frontend/
  playwright.config.ts     # Playwright 配置：testDir、e2e、reporter、webServer、slowMo
  e2e/
    app-journey.spec.ts    # 主旅程用例（侧栏 + Tasks 新建/编辑）
    helpers/
      login.ts             # waitForApiHealthy、loginAsDemo（演示账号）
      sidebar-pages.ts     # 从 nav-config 生成侧栏顺序与每页断言元数据
      task-row.ts          # 在 task-list-common|other 下定位任务行
      step-pause.ts        # 录屏用步骤间 sleep（E2E_STEP_DELAY_MS）
  scripts/
    e2e-run.mjs            # 一键：Docker → migrate → seed → backend → vite → playwright
    e2e-skip-prisma-generate.mjs  # 包装 E2E_SKIP_PRISMA_GENERATE=1 后调 e2e-run
    open-e2e-report.mjs    # 打开 playwright-report（存在性检查）
  TEST-REPORT.md           # 报告产物路径与打开方式
  E2E-实现与数据说明.md    # 本文
```

---

## 4. 环境搭建（实现 E2E 的前置条件）

### 4.1 本机依赖

1. **Node.js**（与仓库 `package.json` / CI 要求一致，建议 LTS）。
2. **Docker Desktop**（或兼容的 Docker 引擎）：用于 `docker compose up -d postgres`。
3. **npm** 在 **`HarvestApp/frontend`** 与 **`HarvestApp/backend`** 均可安装依赖。

### 4.2 安装 Playwright 浏览器（仅需一次）

在 **`frontend`** 目录：

```bash
npm run e2e:install
```

等价于安装 Chromium 浏览器二进制，供 `@playwright/test` 使用。

### 4.3 端口与 URL（默认）

| 用途 | 默认 | 环境变量（可选） |
|------|------|------------------|
| 前端 | `http://localhost:5174` | `E2E_WEB_PORT`、`PLAYWRIGHT_BASE_URL`（由 e2e-run 注入 `PLAYWRIGHT_BASE_URL`） |
| 后端 API | `http://localhost:3000` | `E2E_API_PORT`、`E2E_API_ORIGIN` |
| 健康检查 | `http://localhost:3000/api/health` | `E2E_API_HEALTH_URL` |
| Postgres | `127.0.0.1:5432`，库名与 `docker-compose` / `DATABASE_URL` 一致 | `DATABASE_URL`（e2e-run 内 `ensureBackendEnv` 有默认连接串） |

### 4.4 一键跑通（推荐）

在 **`HarvestApp/frontend`**：

```bash
npm run test:e2e:journey
```

脚本会（顺序概览）：

1. 在仓库根执行 **`docker compose up -d postgres`**，等待容器 **healthy** 与 **5432** TCP 可连。
2. 在 **`backend`**：`prisma generate`（可用 `E2E_SKIP_PRISMA_GENERATE=1` 跳过）、**`prisma migrate deploy`**、**`prisma db seed`**。
3. 启动后端 **`npm run start`**（非 watch），轮询 **`/api/health`**。
4. 启动前端 **`npm run dev -- --port 5174 --strictPort`**，并设置 **`VITE_API_BASE_URL`** 指向后端，轮询首页可访问。
5. 在 **`frontend`** 执行 **`npx playwright test e2e/app-journey.spec.ts`**，且 **`PLAYWRIGHT_SKIP_WEBSERVER=1`**，避免 Playwright 再起一个 Vite。

结束时脚本会尝试结束子进程（前后端）。

### 4.5 已有前后端、只想跑 Playwright

若你已手动 `docker compose`、migrate、seed，并已 **`npm run dev`（5174）** + **后端 3000**：

```bash
cd HarvestApp/frontend
set PLAYWRIGHT_SKIP_WEBSERVER=1
set PLAYWRIGHT_BASE_URL=http://localhost:5174
set E2E_API_HEALTH_URL=http://localhost:3000/api/health
npx playwright test e2e/app-journey.spec.ts
```

（PowerShell 用 `$env:...=...`。）

### 4.6 Windows 上 Prisma `generate` EPERM

若本机已有 **nest/node** 占用 Prisma 引擎 DLL，可：

```bash
npm run test:e2e:journey:fast
```

或先关后端再跑；或设 **`E2E_SKIP_PRISMA_GENERATE=1`**（需本机已生成过 `@prisma/client`）。

---

## 5. npm 脚本一览（frontend/package.json）

| 脚本 | 说明 |
|------|------|
| `test:e2e` | 跑默认 Playwright（未限定文件时跑 `e2e/` 下全部） |
| `test:e2e:journey` | 一键环境 + 只跑 `e2e/app-journey.spec.ts` |
| `test:e2e:journey:fast` | 同上，跳过 prisma generate |
| `test:e2e:ui` / `test:e2e:ui:fast` | Playwright **UI 模式** |
| `test:e2e:journey:record` 等 | 带 `--record`，默认放慢（见下文环境变量） |
| `test:e2e:report:open` | 打开 **`playwright-report`**（需先成功跑过至少一次测试） |
| `e2e:install` | 安装 Chromium |

---

## 6. 环境变量（与「实现方式」强相关）

| 变量 | 作用 |
|------|------|
| `PLAYWRIGHT_SKIP_WEBSERVER` | `1` 时不在 Playwright 内再起 Vite（与 `e2e-run` 配合） |
| `PLAYWRIGHT_BASE_URL` | 被测前端 origin（e2e-run 会设为实际 WEB_ORIGIN） |
| `E2E_API_HEALTH_URL` | `waitForApiHealthy` 轮询地址 |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | 覆盖登录账号（默认见下节） |
| `PLAYWRIGHT_SLOW_MO` | 浏览器操作间隔（ms），录屏用 |
| `E2E_STEP_DELAY_MS` | 步骤间额外停顿（`step-pause.ts`） |
| `E2E_SKIP_PRISMA_GENERATE` | `1` 跳过 `prisma generate` |
| `JWT_SECRET` / `DATABASE_URL` | 后端子进程环境（e2e-run 内有安全默认值） |

`e2e-run.mjs` 若检测到命令行 **`--record`**，会在未设置时默认写入 **`PLAYWRIGHT_SLOW_MO=280`**、**`E2E_STEP_DELAY_MS=900`**。

---

## 7. 数据从哪里来（如何「获取」数据）

E2E **不**在测试文件里直连数据库写业务数据；数据路径是：**Seed → 登录 → 浏览器内 UI/API**。

### 7.1 演示用户与组织（登录凭据）

- **来源**：`backend/prisma/seed.js`（由 `e2e-run` 在 migrate 后执行 **`npm run prisma:seed`**）。
- **默认账号**（与 `e2e/helpers/login.ts` 一致，可被环境变量覆盖）：
  - 邮箱：`demo@harvest.app`
  - 密码：`demo123`
- **内容**：`User` upsert、`Organization` 若不存在则创建、`UserOrganization` 绑定且 **`systemRole: ADMINISTRATOR`**。

登录后前端通过 **`sessionStorage` 中的 JWT**（应用自身实现）调用后续 **REST API**；Playwright 只操作浏览器，不解析 token，除非你在用例里显式 `page.evaluate` 读取。

### 7.2 健康检查与「后端已就绪」

- **`waitForApiHealthy(request)`**：对 **`E2E_API_HEALTH_URL`**（默认 `http://localhost:3000/api/health`）做 **`expect.poll`**，直到 HTTP **200**。
- 这保证用例开始登录时，Nest 已监听。

### 7.3 侧栏顺序与「每页期望文案」

- **来源**：`src/lib/nav-config.ts` 中的 **`appNavSections`**、**`appFooterNavItems`**。
- **用法**：`e2e/helpers/sidebar-pages.ts` 的 **`buildSidebarNavPagesInOrder()`** 遍历同一数据结构，为每个 `item.id` 生成 **`data-testid: sidebar-nav-${id}`** 与对应的 **URL / h1 / listHint** 断言。
- **效果**：侧栏与产品配置**单一数据源**，避免手抄菜单顺序漂移。

### 7.4 Tasks 列表行与任务名

- **列表 DOM**：`tasks-page.tsx` 为 Common/Other 的 `<ul>` 设置 **`data-testid="task-list-common"`**、**`task-list-other"`**；`taskRow()` 在二者下用 **`getByRole('listitem')` + 精确任务名** 定位行。
- **任务名**：用例内 **`E2E journey ${Date.now()}-${test.info().parallelIndex}`**，减少并行/重跑时重名；**创建与更新**通过 UI 点击 **Save**，数据经 **前端 `createTask` / `updateTask` API** 写入后端，**非**测试里直接 `INSERT`。

### 7.5 报告与 Trace 中的「数据」

- **HTML 报告**：`playwright-report/`（`playwright.config.ts` 的 `reporter: html`）。
- **JUnit**：`test-results/e2e-junit.xml`。
- **Trace**：配置为 **`on-first-retry`**，失败重试时有 trace 附件，便于看网络与 DOM 快照。

---

## 8. 主用例逻辑摘要（`app-journey.spec.ts`）

单条串联：**侧栏 → Clients → Projects → Tasks**（均含新建保存与编辑保存）。命令仍为 **`npm run test:e2e:journey`**。

1. **`waitForApiHealthy(request)`** → **`loginAsDemo(page)`**。
2. **`buildSidebarNavPagesInOrder()`**：对每个侧栏项 **`test.step('Sidebar → …')`**（URL / **h1** / **listHint**），**`e2eStepPause()`** 可选。
3. **Clients**：`/clients` → **New client** → **Save client** → 列表 **Edit** → 改名 → **Save client**（定位辅助：`e2e/helpers/clients-projects-rows.ts` 的 **`clientListRow`**）。
4. **Projects**：`/projects/new` → 选择客户 → **Save project** → 列表 **Actions → Edit** → **Save project**（**`projectTableRow`**）。
5. **Tasks**：侧栏 **`sidebar-nav-tasks`** → **New task** → **Edit** → 保存 → 断言停在 **`/tasks`** 列表（**`taskRow`**）。

---

## 9. 如何扩展新 E2E

1. 在 **`frontend/e2e/`** 新增 `*.spec.ts`。
2. 优先 **`data-testid`** 与 **`getByRole`**，避免脆弱 CSS。
3. 需要新侧栏页断言时：在 **`sidebar-pages.ts`** 的 **`ASSERT_BY_NAV_ID`** 增加 `nav-config` 中已有 `id` 的 **url / h1 / listHint**。
4. 若需新 API 就绪条件：可仿照 **`waitForApiHealthy`** 增加 **`expect.poll`**。
5. 本地调试： **`npm run test:e2e:ui`** 选文件单步执行。

---

## 10. 报告与录屏

- 跑完任意带 HTML reporter 的测试后：**`npm run test:e2e:report:open`**（见 **`e2e/TEST-REPORT.md`**）。
- 录屏更慢：**`npm run test:e2e:ui:record`** 或自行提高 **`PLAYWRIGHT_SLOW_MO`** / **`E2E_STEP_DELAY_MS`**。

---

## 11. 常见问题

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `ERR_CONNECTION_REFUSED` 5174 | 未起 Vite 或误设 `PLAYWRIGHT_SKIP_WEBSERVER` 却未手动 dev | 用 `e2e-run` 或自行 `npm run dev` + 正确 `PLAYWRIGHT_BASE_URL` |
| 健康检查一直失败 | 后端未起、端口非 3000、数据库未 migrate | 看 `e2e-run` 日志；本机 `curl` health |
| `No report found at playwright-report` | 未在 **frontend** 跑过测试或从未成功生成报告 | 先 `npm run test:e2e:journey` |
| 登录失败 | seed 未跑、密码被改 | 重跑 `npm run prisma:seed`；或设 `E2E_USER_*` |

---

## 12. 相关文件索引

- Playwright 配置：`frontend/playwright.config.ts`
- 一键编排：`frontend/scripts/e2e-run.mjs`
- Clients / Projects 列表定位：`frontend/e2e/helpers/clients-projects-rows.ts`
- 登录与健康：`frontend/e2e/helpers/login.ts`
- 侧栏数据与断言表：`frontend/e2e/helpers/sidebar-pages.ts`、`frontend/src/lib/nav-config.ts`
- 任务行：`frontend/e2e/helpers/task-row.ts`、`frontend/src/features/tasks/pages/tasks-page.tsx`
- 演示数据：`backend/prisma/seed.js`

---

*文档版本与仓库实现一致；若脚本或端口有变更，请以 `package.json`、`playwright.config.ts`、`e2e-run.mjs` 为准并同步更新本文。*
