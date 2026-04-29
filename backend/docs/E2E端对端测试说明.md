# HarvestApp · 后端 E2E（端对端）测试说明

本文描述 **`backend/`** 中通过 Jest + Supertest 执行的 API 级端对端测试：如何运行、与单元测试/真实数据库的关系、`Prisma` 的 mock 策略，以及如何为新区块扩展用例与 `createE2ePrismaMock`。

相关文档：`backend/docs/单元测试说明.md`（Jest/单测约定）、`backend/docs/Nest后端架构说明.md`（模块结构）。

---

## 1. E2E 在本项目中的定位

| 维度 | 说明 |
|------|------|
| **测什么** | 启动**完整** Nest 应用（`AppModule`），用 HTTP 调真实路由、管道、Guard、Controller、Service 链；在「黑盒」下验证**集成行为**与状态码/响应体形状。 |
| **不测什么** | 默认 **不** 连接真实 PostgreSQL：通过 `Test.createTestingModule` **覆盖** `PrismaService`，由 `test/e2e-prisma-mock.ts` 中的 `createE2ePrismaMock()` 在内存/假返回上模拟数据库。因此这是 **无库的 API 层 E2E**，与「连测试库」的集成/验收测试不同。 |
| **与 `*.spec.ts` 单测** | 单测通常只起被测类 + 局部 mock；E2E 与生产更接近（仍缺真实 DB 与部分 Prisma 行为）。 |
| **适用场景** | 健康检查、鉴权、分页接口、**Tasks** 等关键路径的回归；在 CI 中无需起数据库服务即可跑通。 |

---

## 2. 运行命令与环境

| 命令 | 作用 |
|------|------|
| `cd backend` 后 `npm run test:e2e` | 仅执行 E2E。使用 **`test/jest-e2e.json`**，**不会** 使用主 Jest 配置中面向 `src/**/*.spec.ts` 的那套。 |

E2E 在 `beforeEach` 中设置 `process.env.JWT_SECRET = 'e2e-test-secret'`，与 `JwtService` 签发/校验一致。其它环境变量若业务依赖，可同样在 spec 的 `beforeEach`/`beforeAll` 中追加。

**本地前提**：`backend` 已 `npm install`，`prisma generate` 在构建链中已满足则无需额外操作。

---

## 3. 目录与文件

| 路径 | 作用 |
|------|------|
| `test/jest-e2e.json` | E2E 专用 Jest 配置；`testRegex` 为 `.e2e-spec.ts$`（**仅**匹配以 `.e2e-spec.ts` 结尾的文件）。 |
| `test/app.e2e-spec.ts` | 主 E2E 用例：健康、登录+Projects 列表、**Tasks** 模块多场景。 |
| `test/e2e-prisma-mock.ts` | 导出 `createE2ePrismaMock()` 及 `DEMO_PASSWORD_HASH`、`E2E_USER_ID`、`E2E_ORG_ID` 等，用于覆盖 `PrismaService` 的完整假实现。 |

新 E2E 文件可放在 `test/`，且文件名须符合 `**/*.e2e-spec.ts`，否则不会被 `npm run test:e2e` 拾取（除非改 `testRegex`）。

---

## 4. 应用如何装配

与主程序类似，E2E 在测试中显式做：

1. `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(createE2ePrismaMock())`  
2. `app.setGlobalPrefix('api')`（与主入口一致，所有受测 URL 以 `/api/...` 为前缀）  
3. `ValidationPipe`（`whitelist`、`transform`、`forbidNonWhitelisted` 与主应用同配置，便于与生产校验行为对齐）

`afterEach` 中 `app.close()`，保证用例间隔离。

---

## 5. 登录与固定身份（Prisma mock）

E2E 不连库时，**必须** 在 mock 中提供与登录逻辑一致的「假用户 + 假组织成员」数据，否则鉴权后任意依赖 `userOrganization.findFirst` 的接口会抛错（如历史上 `/api/projects` 出现 `findFirst` 在 `undefined` 上调用）。

- **登录接口**：`POST /api/auth/login`  
- **body**：`{ "email": "demo@harvest.app", "password": "demo123" }`  
- **hash**：`DEMO_PASSWORD_HASH` 在 `e2e-prisma-mock.ts` 中写死，**须与** `bcrypt.hash('demo123', 12)` 的 seed 用哈希一致，否则 `bcrypt.compare` 会失败。  
- **用户 id**：`E2E_USER_ID`（`user-e2e-1`）  
- **组织**：`E2E_ORG_ID`；`userOrganization.findFirst` 为上述用户返回 **ACTIVE** 成员及 `include` 后的 `user` / `organization` 结构，以匹配 `OrganizationContextService.getActiveMembership`。

拿到响应体中的 `access_token` 后，请求头使用：`Authorization: Bearer <access_token>`。

---

## 6. `createE2ePrismaMock()` 说明（扩展必读）

`createE2ePrismaMock()` 在单测进程内维护：

- 最小 **`user` / `userOrganization` / `project` / `expense` / `loginAttempt` / `passwordResetToken`** 等，满足健康检查、登录、**列表项目**、**带组织上下文的业务** 路径。  
- 内存表 **`taskRows`**，实现 `task` 的 `findMany` / `findFirst` / `create` / `update` / `updateMany` / `delete` 等，以支撑 **Tasks** 的列表、详情、创建、更新、归档、批量归档、删除、导出。  
- `$transaction`：对「函数式」与「数组式」调用做简化实现，与 `task.delete` 中 `deleteMany` + `delete` 等一致。  
- **`projectTask.findFirst`**：在「仅 `projectId+taskId`」场景返回 `null`（无关联），避免干扰「挂到项目」等逻辑；删除前「是否有工时」路径下亦保持安全。

为**新模块**加 E2E 时，若调用了尚未在 mock 中出现的 `this.prisma.<model>.<method>`，需在同一文件中补全对应 `jest.fn()` 或可执行的 `mockImplementation`；**优先**复用与业务一致的 `where` 分支，对 `E2E_USER_ID` / `E2E_ORG_ID` 做针对性返回，避免一把返回 `[]` 导致与 Guard/组织校验矛盾。

建议每次扩展后本地执行 `npm run test:e2e`，并关注 Nest 层抛出的 500 栈，定位缺失的 Prisma 访问点。

---

## 7. 当前用例覆盖（`test/app.e2e-spec.ts`）

以下为编写文档时的**约定行为**，若代码有变更，请以用例与实现为准。

| 场景 | 方法/路径 | 成功状态码 | 说明 |
|------|------------|------------|------|
| 健康 | `GET /api/health` | 200 | 无需 `Authorization`；`database: true` 由 `$queryRaw` mock 支持。 |
| 登录+项目列表 | `POST /api/auth/login` → `GET /api/projects` | 200 / 200 | 带 JWT；分页体见断言（如 `meta.page` 等）。 |
| 任务列表 | `GET /api/tasks` | 200 | 响应含 `common` / `other` 分区。 |
| 单条任务 | `GET /api/tasks/:id` | 200 | 预置如 `task-common-1` 等。 |
| 创建任务 | `POST /api/tasks` | **201** | Nest 对资源创建可返回 201。 |
| 更新任务 | `PATCH /api/tasks/:id` | 200 |  |
| 单条归档 | `POST /api/tasks/:id/archive` | **201** |  |
| 批量归档 | `POST /api/tasks/batch/archive` | **201** | body 含 `ids: string[]` |
| 删除 | `DELETE /api/tasks/:id` | 200 | 无工时、无不当关联时的删除路径。 |
| 导出 | `GET /api/tasks/export?format=json` | 200 | 附件式 JSON 响应体。 |

> **注意**：若日后为 Controller 显式加 `@HttpCode(200)` 等，上表中的 **201/200** 以实际为准，需同步改断言与本文。

---

## 8. 常见问题

**Q：E2E 会跑前端吗？**  
A：不会。本仓库的 E2E 仅指 `backend` 的 HTTP API；若需浏览器级 E2E，通常在 `frontend` 用 Playwright / Cypress 等另建项目说明。

**Q：为何不用 `docker` 起真实库？**  
A：当前策略优先 **CI/本地零外部依赖、速度快**。若需「全栈真实库」验收，可另加 job 与连接串，并去掉 `PrismaService` 的 `override`（或条件分支）。

**Q：新增接口返回 500，但单测过？**  
A：单测的 Prisma 往往只 mock 了该 Service 用到的子集。E2E 走**整条** `AppModule` 与真实 `OrganizationContext` 等，**必须在 `createE2ePrismaMock` 中补全** 新调用的 `prisma` 方法。

**Q：能否只跑某一个 E2E 文件？**  
A：可以。例如 Jest 30+：`npx jest --config ./test/jest-e2e.json --testPathPatterns=app.e2e-spec`（在 `backend` 目录下执行，路径以实际文件名为准）。

---

## 9. 维护清单（改代码时自检）

- [ ] 新接口若需 E2E：在 `*.e2e-spec.ts` 增加用例，并**补全** `e2e-prisma-mock.ts` 中可能缺失的 `prisma` 分派。  
- [ ] 登录/密码/用户 id 与 `e2e-prisma-mock` 中的常亮保持一致。  
- [ ] 全局前缀固定为 `api` 时，请求路径勿漏 `/api`。  
- [ ] 与本文档 7 节中状态码/响应形状不一致时，**更新**本说明或测试断言，避免文档与用例长期漂移。

---

*（文档随 `test/app.e2e-spec.ts` 与 `test/e2e-prisma-mock.ts` 的演进可定期复审。）*
