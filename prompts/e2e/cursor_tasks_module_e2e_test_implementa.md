# Tasks module e2e test implementation
_Exported on 2026/4/30 at GMT+8 10:11:59 from Cursor (3.1.14)_

---

**User**

需要实现一下 Tasks 模块 @tasks 的 e2e test，当然也应该包含登录，考虑通过在 e2e 的 `prismaMock` 里补全的方式
F:\AI\code\HarvestApp\backend>npm run test:e2e

> backend@0.0.1 test:e2e
> jest --config ./test/jest-e2e.json

[Nest] 42832  - 2026/04/29 18:44:58   ERROR [ExceptionsHandler] TypeError: Cannot read properties of undefined (reading 'findFirst')
    at OrganizationContextService.getActiveMembership (F:\AI\code\HarvestApp\backend\src\modules\organization\organization-context.service.ts:64:52)
    at ProjectsService.listProjectsPaginated (F:\AI\code\HarvestApp\backend\src\modules\projects\projects.service.ts:262:37)
    at ProjectsController.list (F:\AI\code\HarvestApp\backend\src\modules\projects\projects.controller.ts:37:33)
    at F:\AI\code\HarvestApp\backend\node_modules\@nestjs\core\router\router-execution-context.js:38:29
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at F:\AI\code\HarvestApp\backend\node_modules\@nestjs\core\router\router-execution-context.js:46:28
    at F:\AI\code\HarvestApp\backend\node_modules\@nestjs\core\router\router-proxy.js:9:17
 FAIL  test/app.e2e-spec.ts (12.12 s)
  HarvestApp API (e2e)
    √ /api/health (GET) 无需令牌 (81 ms)
    × 登录后可用 JWT 访问 /api/projects (517 ms)

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
Time:        13.348 s
Ran all test suites.

---

**Cursor**

分析 e2e 失败原因并补全 `prismaMock`，随后为 Tasks 模块添加 e2e 测试。正在查看现有测试与相关服务代码。



正在实现 `e2e-prisma-mock.ts` 并更新 `app.e2e-spec.ts`。



正在添加完整的 `e2e-prisma-mock` 与 Tasks 的 e2e 测试。



正在更新 `app.e2e-spec.ts`。



将 POST 创建任务的期望状态码改为 `201`（Nest 对创建资源返回 201）。



e2e 已全部通过。变更总结如下：

## 根因

`/api/projects` 会调用 `OrganizationContextService.getActiveMembership`，里面对 `this.prisma.userOrganization.findFirst` 有依赖。原先 `prismaMock` 里没有 `userOrganization`，得到 `undefined.findFirst` 就 500 了。

## 做法

1. **新增 `test/e2e-prisma-mock.ts`**，集中 `createE2ePrismaMock()`：
   - **`userOrganization.findFirst`**：为 `E2E_USER_ID` / `E2E_ORG_ID` 返回完整成员行（含 `user`、`organization`），与真实 Prisma 的 `include` 结果一致。
   - **`user.findUnique`**：在按 `id` 查询时同样返回 demo 用户（避免其它链路透传 id）。
   - **`expense.groupBy`**：在将来 `project` 有数据时避免 500，当前用 `[]`。
   - **`task` / `projectTask`**：用内存 `taskRows` 模拟 `findMany` / `findFirst` / `create` / `update` / `updateMany` / `delete`，以支撑 Tasks 全流程；`projectTask.findFirst` 对 `projectId+taskId` 返回 `null`（无项目关联），`delete` 路径安全。
2. **改写 `app.e2e-spec.ts`**：使用上述 mock，并增加 **Tasks** 用例：登录后 `GET` 列表与详情、`POST` 创建、`PATCH`、`POST` 单条与批量归档、`DELETE`、**`GET /api/tasks/export?format=json`**。
3. 写对 **状态码**：创建类接口为 **201**（`POST` 建任务、归档、批量归档等），与当前 Nest 行为一致。

在 `F:\AI\code\HarvestApp\backend` 下执行 `npm run test:e2e` 应看到 **7 个测试全部通过**。之后若在 e2e 里加其它依赖 Prisma 的模块，在 `e2e-prisma-mock.ts` 里按同样方式补全对应 model 方法即可。

---

**User**

@docs 请在这个目录下生成一个e2e的详细文档

---

**Cursor**

查看 HarvestApp 的 `docs` 目录和现有 e2e 相关文件，以便编写准确文档。



正在于 `F:\AI\code\HarvestApp\docs\` 创建 E2E 说明文档，风格与 `backend/docs/单元测试说明.md` 保持一致。



已在 `F:\AI\code\HarvestApp\docs\` 创建 `E2E端对端测试说明.md`。正在向 `backend/docs/单元测试说明.md` 的 E2E 行添加引用，便于从后端文档跳转到新说明。



已在仓库根目录的 **`docs`** 下新增 E2E 说明文档：

**路径**：`F:\AI\code\HarvestApp\docs\E2E端对端测试说明.md`

**文档结构概览**：

1. **E2E 在本项目中的含义** — 全量 `AppModule` + Supertest、与单测/真实库的区别。  
2. **运行方式** — `npm run test:e2e` 与 `jest-e2e.json`。  
3. **目录与文件** — `app.e2e-spec.ts`、`e2e-prisma-mock.ts`、`*.e2e-spec.ts` 命名规则。  
4. **应用装配** — 覆盖 `PrismaService`、全局前缀 `api`、`ValidationPipe`。  
5. **登录与固定数据** — `demo@harvest.app`、密码与 bcrypt 哈希、`E2E_USER_ID` / `E2E_ORG_ID`、组织成员关系为何必须 mock。  
6. **`createE2ePrismaMock` 扩展说明** — 新模块时如何补 Prisma、易错点。  
7. **当前用例表** — 各接口与预期状态码（含 201 的说明）。  
8. **常见问题** — 与前端 E2E、真库、只跑单文件等。  
9. **维护清单** — 改代码后的自检项。

若你希望把「根目录 `docs`」改为只放在 `backend/docs`（与《单元测试说明》同层），可以说一下，我可以把同一份内容迁到 `backend/docs` 并保留或删除根目录版本。

