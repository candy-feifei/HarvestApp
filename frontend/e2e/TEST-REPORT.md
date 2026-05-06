# E2E 测试报告（App journey）

技术栈、搭建流程与数据来源见 **[E2E-实现与数据说明.md](./E2E-实现与数据说明.md)**。

## 如何生成

在 **`frontend`** 目录执行（需本机已按项目说明起好 Docker Postgres、后端与 E2E 脚本，或一键）：

```bash
npm run test:e2e:journey
```

或跳过 prisma generate（Windows 常用）：

```bash
npm run test:e2e:journey:fast
```

每次跑完 Playwright 会写出下列报告（目录已在 `.gitignore` 中忽略，勿提交仓库）。

## 报告产物

| 类型 | 路径 | 说明 |
|------|------|------|
| **HTML** | `frontend/playwright-report/` | 浏览器打开可查看用例、耗时、失败栈、trace（若启用） |
| **JUnit XML** | `frontend/test-results/e2e-junit.xml` | 给 CI（GitHub Actions、Jenkins 等）解析 |

## 打开 HTML 报告

**必须先**在 **`HarvestApp/frontend`** 下成功跑完至少一次带 HTML 输出的用例（例如 `npm run test:e2e:journey`），才会生成 `playwright-report/`。若从未跑过或不在 `frontend` 目录执行，会出现「找不到报告」。

在 **`frontend`** 目录：

```bash
npm run test:e2e:report:open
```

该命令会解析本包下的 `playwright-report` 绝对路径并调用 `playwright show-report`；若目录不存在会打印中文说明。

## 当前覆盖：`e2e/app-journey.spec.ts`

**用例名：** `sidebar → Clients → Projects → Tasks (create/edit save)`

**范围摘要：**

1. API 健康检查 → 演示账号登录。
2. 按 `src/lib/nav-config` 顺序点击侧栏每一项，每步 `test.step`：`Sidebar → …`。
3. **Clients**：新建客户保存 → 列表 **Edit** → 改名保存。
4. **Projects**：新建项目（绑定上一步客户）保存 → 列表 **Actions → Edit** → 改名保存。
5. **Tasks**：侧栏进入 Tasks → **New task** → 行 **Actions → Edit** → 保存；断言结束在 `/tasks` 列表。

**说明：** Tasks 无独立编辑路由，为页内联表单。

## 配置位置

- Playwright：`frontend/playwright.config.ts`（`reporter`：`list` + `html` + `junit`）
- 用例：`frontend/e2e/app-journey.spec.ts`
