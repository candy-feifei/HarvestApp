# Vitest coverage report installation
_Exported on 2026/4/29 at GMT+8 15:06:40 from Cursor (3.1.14)_

---

**User**

请为前端@frontend  (Vitest)安装`@vitest/coverage-v8` ，以便生成测试报告

---

**Cursor**

正在查看前端的 Vitest 配置和 `package.json`，以便正确安装并配置 `@vitest/coverage-v8`。



正在安装 `@vitest/coverage-v8`，并在 `vite.config.ts` 中配置 coverage，并添加 `test:coverage` 脚本。



正在安装与 Vitest 3.2 匹配的 `@vitest/coverage-v8@3` 版本。



正在将 coverage 配置写入 `vite.config.ts`，并添加 `test:coverage` 脚本。



---

**User**

前端@frontend  (Vitest)安装`@vitest/coverage-v8` 已经安装完成了吗，应该如何生成测试报告？

---

**Cursor**

正在确认前端的安装与配置是否完整。



**是的，已经装好了。** 当前 `frontend/package.json` 里包含 `"@vitest/coverage-v8": "^3.2.4"`，与项目里的 **Vitest 3.2** 主版本一致；`vite.config.ts` 里也已设置 `provider: 'v8'` 和 `reporter: ['text', 'html', 'json']`，并指定输出目录为 `frontend/coverage`。

---

### 如何生成测试覆盖率报告

在 **frontend 目录**执行：

```bash
npm run test:coverage
```

（等价于 `vitest run --coverage`。）

执行完成后会得到：

| 形式 | 位置 / 说明 |
|------|----------------|
| **终端摘要** | 标准输出里的文本表格（`text`） |
| **HTML 报告** | `frontend/coverage/index.html`，用浏览器打开即可查看行/分支等详情 |
| **JSON** | `frontend/coverage/coverage-final.json`（或类似最终汇总文件，视 Vitest 版本略有命名差异） |

若只想看终端、不产 HTML，可临时用：

```bash
npx vitest run --coverage --reporter=text
```

（或在 `vite.config.ts` 的 `coverage.reporter` 里按需增删。）

**说明：** `coverage/` 一般应加入 `.gitignore`，避免把报告提交进仓库；若还没有，可加上 `coverage` 这一行。

---

**User**

请更新一下前端 doc 目录下的 单元测试说明，另外现在只有tasks模块生成了单元测试，coverage可以单独运行tasks这一个模块吗

---

**Cursor**

正在阅读 `单元测试说明.md` 和 `package.json`，随后更新文档并添加可单独对 tasks 模块跑 coverage 的脚本（若需要）。



正在确认 Vitest 的 `--coverage.include` 在 Windows 下的用法，并添加 `test:coverage:tasks` 脚本。



正在更新文档，并将 `coverage/` 加入 `frontend/.gitignore`。



已完成这些修改：

### 1. 文档 `frontend/docs/单元测试说明.md`
- 技术栈补充 **`@vitest/coverage-v8`**，并说明 `vite.config.ts` 里 `test.coverage` 的用途。
- **npm 脚本表** 增加 `test:coverage`、`test:coverage:tasks`，并说明当前以 **tasks** 单测为主、其它模块可仿照加脚本。
- **第 6 节** 改为与现状一致：依赖、输出目录、全量与「仅某模块」两种用法，去掉「尚未配置」的旧描述。
- 专写 **6.3**：说明可以单独做 **tasks 模块** 覆盖率，并给出 CLI 通式。
- 索引表增加 `package.json` 脚本说明；CI 建议中顺带提到可按需加 coverage。
- 全篇用 **「第 6 节」** 作交叉引用，未使用 `§` 符号。

### 2. 脚本 `test:coverage:tasks`
已在 `package.json` 增加并本地跑通：

`vitest run --coverage --coverage.include=src/features/tasks/** src/features/tasks`

- **`src/features/tasks`**：只跑该路径下的测试文件。  
- **`--coverage.include=src/features/tasks/**`**：覆盖报告**只统计**该目录下源码，避免在「只有 tasks 有测试」时全 `src` 出现大片 0%。

**可以**：单独对 tasks 跑 coverage，请用 `npm run test:coverage:tasks`。

### 3. `frontend/.gitignore`
- 已加入 **`coverage`**，避免把生成的覆盖率报告提交进 Git。

若你希望 **全仓库** 覆盖率又默认只看 tasks，可以把 `vite.config` 里默认的 `coverage.include` 也收窄；当前更稳妥的做法是：**全量用** `test:coverage`，**只关心 tasks 时用** `test:coverage:tasks`。

---

**User**

@backend 也需要更新一下后端docs 下的单元测试说明，加上单独执行 tasks 模块带覆盖率的测试说明

---

**Cursor**

查看后端的测试配置与文档内容。



正在添加 `test:cov:tasks` 脚本并验证；随后更新文档。



正在更新 `backend/docs/单元测试说明.md`。



已做完两件事：

### 1. `backend/package.json` 增加脚本

```json
"test:cov:tasks": "jest --coverage --testPathPatterns=modules/tasks --collectCoverageFrom=modules/tasks/**/*.ts"
```

- **`--testPathPatterns=modules/tasks`**：与现有 `test:tasks` 一致，只跑 `src/modules/tasks` 下的 `*.spec.ts`。
- **`--collectCoverageFrom=modules/tasks/**/*.ts`**：覆盖率只统计该模块源码（相对 Jest 的 `rootDir: src`），避免全量 `test:cov` 时整库都进报告。

已在本地执行 `npm run test:cov:tasks` 验证通过。

### 2. 更新 `backend/docs/单元测试说明.md`

- **第 2 节**：补充 `test:cov:tasks`，并区分 `test:cov`（全量）、`test:cov:tasks`（tasks + 覆盖率）、`test:tasks`（仅跑用例、无覆盖率）。
- **第 5 节**：说明全量与 `test:cov:tasks` 对 `collectCoverageFrom` 的关系。
- **第 6.1 节**：写清全量 / tasks 专项命令、报告目录 `backend/coverage/lcov-report/index.html`、后一次运行会覆盖同目录结果，以及如何用同样方式做其它模块。
- **第 7 节**：索引里 `package.json` 一行注明上述脚本；交叉引用改为「第 6.1 节」，未使用 `§`。

说明：HTML 报告仍输出到 **backend 根下** `coverage/`（与全量相同）；若先跑全量再跑 `test:cov:tasks`，**终端与 HTML 都会变成仅 tasks 的统计**，属 Jest/istanbul 的正常行为，文档里已提醒。

---

**User**

还有个问题，在目前的前后端单元测试报告中，如何测试覆盖率 和 断言质量

---

**Cursor**

下面分两块说：**覆盖率**（报告里能直接看到）和**断言质量**（报告里基本看不到，要靠别的方式把关）。

---

## 一、如何看「测试覆盖率」

前后端虽然工具不同（前端 Vitest + `@vitest/coverage-v8`，后端 Jest + Istanbul），**指标含义**类似：

| 指标 | 常见含义 | 使用注意 |
|------|----------|----------|
| **Statements** | 语句是否执行到 | 最粗，容易「刷高」 |
| **Branches** | `if/else`、`?:`、`\|\|` 等分支是否两边都走到 | 比行数更敏感，**更值得盯** |
| **Functions** | 函数是否被调用过 | 调用了但可能只测了 happy path |
| **Lines** | 可执行行是否覆盖 | 和 statement 常一起出现 |

**在报告里怎么做：**

1. **打开 HTML 报告**（前端 `coverage/index.html`，后端 `coverage/lcov-report/index.html`），点进**具体文件**，看**未覆盖行**（常标红/灰）——是「死代码」、难分支，还是**该测却没测**的业务逻辑。  
2. **优先补**：核心业务路径、错误分支、权限/校验失败路径；而不是为追求 100% 去测 `getXxx` 的每一行。  
3. **全量 vs 按模块**（你们已有 `test:coverage:tasks` / `test:cov:tasks`）：在「只迭代单模块」时，用**收窄范围**的覆盖率，避免被其它模块 0% 干扰判断；**门禁或发布前**再跑全量，看整库健康度。  
4. **覆盖率的上限意识**：高覆盖率 ≠ 测得好；**低覆盖率**几乎一定说明有代码没被任何测试碰到，**值得先补测或说明为何不测**（如纯 DTO 装饰器、生成代码）。

**可量化「底线」**（在配置里加 **thresholds**，需要团队拍板一个数）：例如行/分支不低于某百分比，或在 CI 里**仅对关键目录**做门禁。这管的是**广度**，不管**断言写得好不好**。

---

## 二、如何看「断言质量」（报告里没有单独一项）

**覆盖率只回答「这行执没执行过」，不回答「断的是不是关键行为、会不会误报/漏报」。** 要评估断言质量，可以结合：

### 1. 人工/CR 时看的要点

- **断的是不是「对外可观察结果」**：例如应断言「接口返回/DB 调用参数/HTTP 状态和用户可见错误」，而不是只断言「某个 `mock` 被调了一次」而不管参数是否合理。  
- **负面与边界**：除成功路径外，是否对非法输入、空列表、无权限、下游失败有断言。  
- **是否绑死实现细节**：过度断言内部私有函数调用顺序，改实现就要全改测试，一般是断言质量差的表现。  
- **Mock 的严格程度**：`toHaveBeenCalledWith` 是否比 `toHaveBeenCalled` 更能防止回归。

### 2. 和工具相关的补充（可选、进阶）

- **变异测试**（如 Stryker、Vitest 生态里的变异相关工具）：故意改一行业务代码，看测试会不会失败；改不死说明断言可能**太弱**——这是对「测得紧不紧」的自动化补充，**成本较高**，一般用于核心模块。  
- **Property-based / 随机输入**（如 fast-check）：补边界情况，**间接**提高断言「抓到真 bug」的概率。  

这些通常**不会**出现在你们现在的 HTML 覆盖率里，要单独接工具或流程。

### 3. 小结成一张表

| 维度 | 主要手段 | 报告里能否直接看到 |
|------|----------|---------------------|
| **覆盖率** | HTML/终端 coverage、可设 `thresholds`、按模块/全量 | ✅ 能 |
| **断言质量** | 代码审查清单、对关键用例要求「参数级」断言、变异测试等 | ❌ 不能，需过程与可选工具 |

---

**一句话**：用覆盖率报告看**还有哪段逻辑没被执行业务测试**；用**审查和（可选的）变异测试**看**断言是否守住正确行为**。两者一起用，比单独盯覆盖率百分比更有意义。

若你希望把其中一节**精简**写进前后端 `单元测试说明.md`（只加一个小节、不扩太长），可以说明要偏「团队规范」还是「新手指南」，我可以按你的仓库结构改一版文案。

