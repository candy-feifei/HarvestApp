# Unit testing technologies for backend and frontend
_Exported on 2026/4/29 at GMT+8 14:30:57 from Cursor (3.1.14)_

---

**User**

@backend @frontend 我想对这两个项目做单元测试，推荐哪种技术，Jest‌可以吗

---

**Cursor**

可以，**Jest 很适合你这个项目组合**（`backend` + `frontend`），而且生态成熟、上手快。推荐按下面这样选型：

## 后端（看起来是 NestJS/Node）
- **单元测试框架**：**Jest（首选）**
- **NestJS 常见搭配**：`@nestjs/testing` + Jest
- **HTTP/控制器集成测试**（可选）：`supertest`
- **数据库相关**：单元测试用 **mock**（不要直连真实 DB）；需要验证 SQL/Repository 的再做少量集成测试（例如 Testcontainers 或 sqlite/in-memory 方案，按你后端架构定）

结论：**后端用 Jest 完全没问题，也是 NestJS 官方/社区主流。**

## 前端（React/TS 典型）
前端现在更主流有两条路：

- **推荐**：**Vitest + Testing Library**
  - 优点：通常比 Jest 更快（Vite 体系），配置更轻
  - 组件测试：`@testing-library/react`
  - DOM 断言：`@testing-library/jest-dom`（Vitest 也能用）

- **也可以**：**Jest + Testing Library**
  - 优点：你如果想前后端统一一套测试运行器/习惯，Jest 很稳
  - 缺点：在 Vite/ESM 场景下有时配置更“重”一点（但不是不能用）

结论：**前端 Jest 可以用；但如果你的前端是 Vite，通常更推荐 Vitest。**

## 我给你的整体推荐（最省心/最主流）
- **后端**：Jest（+ `@nestjs/testing`，可选 supertest）
- **前端**：Vitest（+ React Testing Library）
- **端到端（E2E）**（以后需要再加）：Playwright（比 Cypress 更通用些）

---

如果你告诉我前端是否是 **Vite**（看 `package.json` 里有没有 `vite`），以及后端是否 **NestJS**，我可以直接给你一套对应的最小配置与示例测试用例结构（含 `test` 脚本、目录约定、mock 策略）。

---

**User**

后端是NestJS，前端是 Vite 框架 React，按照推荐后端使用Jest，前端使用Vitest，请先生成一下 Tasks 模块对应的最小配置与示例测试用例结构（含 test 脚本、目录约定、mock 策略）， Tasks 模块后端代码在 @tasks ，前端代码在 @tasks 

---

**Cursor**

正在查看 backend 与 frontend 中 Tasks 模块的结构及现有配置。



正在添加后端 `tasks.service.spec.ts`、前端 Vitest 配置，以及 `api` 与 `TasksPage` 的示例测试。



---

**User**

backend 运行命令出错了：
F:\AI\code\HarvestApp\backend>npm run test:tasks

> backend@0.0.1 test:tasks
> jest --testPathPattern=modules/tasks

testPathPattern:

  Option "testPathPattern" was replaced by "--testPathPatterns". "--testPathPatterns" is only available as a command-line option.

  Please update your configuration.

  CLI Options Documentation:
  https://jestjs.io/docs/cli

---

**Cursor**

Jest 30 将 `--testPathPattern` 替换为 `--testPathPatterns`。正在更新 `package.json` 中的脚本。



已经改好了。Jest 30 里旧参数 `--testPathPattern` 被去掉，需改用 **`--testPathPatterns`**（注意末尾有 `s`）。

`package.json` 里现在是：

```json
"test:tasks": "jest --testPathPatterns=modules/tasks"
```

在本地执行 `npm run test:tasks` 已通过（3 个测试全部成功）。

---

**User**

需要在后端 @docs 和前端 @docs 目录下分别生成一下单元测试的说明文档

---

**Cursor**

正在创建与现有文档风格一致的两份《单元测试说明》。



已在两个仓库里写好说明文档，路径如下：

| 位置 | 文件 |
|------|------|
| 后端 | `backend/docs/单元测试说明.md` |
| 前端 | `frontend/docs/单元测试说明.md` |

**后端文档**主要包括：Jest + ts-jest + `@nestjs/testing`、`rootDir`/`testRegex` 与 `*.spec.ts` 约定、`npm test` / `test:tasks` / `test:e2e`、对 `PrismaService` 的 mock 建议、与 e2e 的分工、相关文件索引（含 Jest 30 的 `--testPathPatterns` 说明）。

**前端文档**主要包括：Vitest + jsdom + Testing Library、`vite.config.ts` 里 `test` 段、`test` / `test:run` / `test:tasks`、`*.test.ts(x)` 与 `vitest.setup.ts` 的位置、对 `apiRequest` 与 `features/*/api` 的 mock 策略、Query 页面测试注意点、MSW 作为可选项、ESLint 与 CI 建议。

风格上延续了你们现有的《Nest后端架构说明》《前端搭建说明》里用的标题、表格和「相关文件」小节，便于和 `docs` 里其它文章一起阅读。若你还希望从《Nest后端架构说明》里加一段「见单元测试说明」的交叉链接，可以说明要链到哪一节，我可以帮你改一版链接文案（你未要求前我没有动其它 md）。

---

**User**

@HarvestApp/backend/docs/单元测试说明.md:31 目前项目中 e2e 测试可以用了吗，我测试目前运行有问题  F:\AI\code\HarvestApp\backend>npm run test:e2e

> backend@0.0.1 test:e2e
> jest --config ./test/jest-e2e.json

[Nest] 35112  - 2026/04/28 09:30:27   ERROR [ExceptionsHandler] TypeError: Cannot read properties of undefined (reading 'findFirst')
    at OrganizationContextService.getActiveMembership (F:\AI\code\HarvestApp\backend\src\modules\organization\organization-context.service.ts:58:52)
    at ProjectsService.listProjectsPaginated (F:\AI\code\HarvestApp\backend\src\modules\projects\projects.service.ts:271:37)
    at ProjectsController.list (F:\AI\code\HarvestApp\backend\src\modules\projects\projects.controller.ts:37:33)
    at F:\AI\code\HarvestApp\backend\node_modules\@nestjs\core\router\router-execution-context.js:38:29
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at F:\AI\code\HarvestApp\backend\node_modules\@nestjs\core\router\router-execution-context.js:46:28
    at F:\AI\code\HarvestApp\backend\node_modules\@nestjs\core\router\router-proxy.js:9:17
 FAIL  test/app.e2e-spec.ts (9.947 s)
  HarvestApp API (e2e)
    √ /api/health (GET) 无需令牌 (169 ms)
    × 登录后可用 JWT 访问 /api/projects (325 ms)

  ● HarvestApp API (e2e) › 登录后可用 JWT 访问 /api/projects

    expected 200 "OK", got 500 "Internal Server Error"

      111 |       .get('/api/projects')
      112 |       .set('Authorization', `Bearer ${loginBody.access_token}`)
    > 113 |       .expect(200)
          |        ^
      114 |       .expect((res) => {
      115 |         const body = res.body as {
      116 |           data: unknown[];

      at Object.<anonymous> (app.e2e-spec.ts:113:8)
      ----
      at Test._assertStatus (../node_modules/supertest/lib/test.js:309:14)
      at ../node_modules/supertest/lib/test.js:365:13
      at Test._assertFunction (../node_modules/supertest/lib/test.js:342:13)
      at Test.assert (../node_modules/supertest/lib/test.js:195:23)
      at localAssert (../node_modules/supertest/lib/test.js:138:14)
      at Server.<anonymous> (../node_modules/supertest/lib/test.js:152:11)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 passed, 2 total
Snapshots:   0 total
Time:        10.563 s
Ran all test suites.
先确认e2e是否可用，先不要改

---

**Cursor**

正在查看 e2e 的启动方式与出错代码路径，以判断当前 e2e 是否处于可用状态（按你的要求先不改代码）。



结论先说：**e2e 这条命令能跑起来，但当前仓库里的 e2e 并不是“全绿可用”的状态**——你遇到的是**用例与 Prisma mock 不完整**导致的问题，不是 Jest/Supertest 本身坏了。

## 1. 现在什么算“能用”

- `test/jest-e2e.json` + `app.e2e-spec.ts` 能**正常启动应用**、用 **Supertest** 发请求。
- 第一个用例 **`GET /api/health` 不依赖 Prisma 里被 mock 缺的那一块**，所以能通过。
- 第二个用例在 **登录成功之后** 调 `GET /api/projects` 时，会走进 **`OrganizationContextService.getActiveMembership`**，这里会调：

```58:66:f:\AI\code\HarvestApp\backend\src\modules\organization\organization-context.service.ts
    const row = await this.prisma.userOrganization.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
      include: {
        organization: {
          select: { id: true, name: true, defaultCurrency: true },
        },
      },
    });
```

## 2. 为什么报 `findFirst` of undefined

e2e 里用 `overrideProvider(PrismaService).useValue(prismaMock)` 换掉了真 `PrismaService`（见 `test/app.e2e-spec.ts` 第 18–69 行左右）。这个 **`prismaMock` 里只 mock 了 `user`、`project`、`loginAttempt`、`passwordResetToken` 等，没有 `userOrganization`**。

因此运行时 **`this.prisma.userOrganization` 是 `undefined`**，在**第 58 行**访问 `.findFirst` 就会得到你看到的：

`Cannot read properties of undefined (reading 'findFirst')`

也就是：**不是业务逻辑随机出错，而是 e2e 的 Prisma 假对象缺了 `userOrganization`（以及后续可能还会用到的表）**。

## 3. 对你问题的直接回答

| 问题 | 说明 |
|------|------|
| “e2e 测试可以用了吗？” | **框架层面可以用**（能跑、能测真实 HTTP 路径）。**当前项目里这条 `npm run test:e2e` 不能当绿 CI 用**，因为**至少 `登录后访问 /api/projects` 会失败**。 |
| 你这次失败 | **预期内的技术原因**：mock 与现版 `OrganizationContextService` 不同步。 |

**按你的要求先不改代码**：从现状看，文档里写 `npm run test:e2e` 会跑 e2e **没错**，但应把预期说清楚——**在补齐 mock 或改为连测试库之前，这条用例不保证通过**。若你之后要修，方向就是在 e2e 的 `prismaMock` 里补 `userOrganization`（以及 `ensureDefaultMembership` / `ProjectsService` 等路径可能再需要的模型），或改成真实/嵌入式数据库跑集成测试。

---

**User**

@单元测试说明.md @单元测试说明.md 根据目前的前后端单元测试，是否有相关插件，可以实现每次执行完测试命令，直接生成可视化的测试报告

---

**Cursor**

说明可选方案，并在两份《单元测试说明》中补充“可视化报告”小节。



正在将“可视化报告”的说明加入两份《单元测试说明》。说明：Jest/Vitest 的**覆盖率报告**最成熟；**用例通过/失败**的独立 HTML 需额外 reporter 包。



## 结论概览

**有。大致分三类：**

| 目标 | 后端 (Jest) | 前端 (Vitest) |
|------|-------------|----------------|
| **行/分支覆盖率（浏览器里看的 HTML 报告）** | 已有 `npm run test:cov` → 生成 **`coverage/lcov-report/index.html`**，**不用装额外插件** | 需加 **`@vitest/coverage-v8`** 等，并在 `vite.config` 里开 `test.coverage`，再 `vitest run --coverage` → 一般为 **`coverage/index.html`**（以配置为准） |
| **测试结束后在浏览器里点着看（树、时间线等）** | 无与 Vitest UI 对等的官方面板；可依赖覆盖率 HTML 或接第三方 | 安装 **`@vitest/ui`**，执行 **`npx vitest --ui`** |
| **「用例名 + 通过/失败」的独立 HTML 汇总** | 默认**没有**；可装 **jest-html-reporter** 等，并在 Jest 里配 `reporters` | 可看 Vitest 的 **`reporters`**（如官方支持的 `html`）或接 CI/其它展示工具 |

**说明：**  
- 「每次跑完**自动在浏览器里打开**报告」不是 Jest/Vitest 默认行为，一般是再加一层脚本（例如用 `open-cli` 或系统 `start` / `open` 打开生成的 `index.html`），或在 CI 里把 `coverage` 当产物上传。  
- 你们后端 **`test:cov` 已经能出可视化覆盖率**；前端若还没接 coverage，需要先按 Vitest 文档加 provider 和配置，才有 HTML 覆盖率报告。

已在以下文档中增加 **「可视化测试报告」** 小节，并与现有章节编号衔接好：

- `backend/docs/单元测试说明.md` → **§6**（§7 为相关文件索引）  
- `frontend/docs/单元测试说明.md` → **§6**（原 §6、§7 顺延为 **§7、§8**）

