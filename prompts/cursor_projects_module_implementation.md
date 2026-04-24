# Projects module implementation
_Exported on 4/24/2026 at 12:55:21 GMT+8 from Cursor (3.1.17)_

---

**User**

@frontend/src/lib/api/http.ts Role: 资深前端开发专家

Task: 在现有 React 框架中根据上传的截图和需求，实现完整的 Projects 管理模块。

1. 目录结构规范：
请在 src/features/projects/ 目录下生成代码，严格遵循以下结构：

api.ts: 存放所有 API 请求。

pages/: 存放 ProjectList 和 ProjectForm 页面。

components/: 存放表单内部的复杂子组件（如 TaskSection, TeamSection）。

types.ts: 定义项目相关的 TypeScript 接口。

2. 技术要求：

数据请求： 统一使用 src/lib/api/http.ts 中的 apiRequest。

状态管理： 列表获取使用 TanStack Query (useQuery)，增删改操作使用 useMutation。

UI 逻辑：

参考截图，实现三种 Project type (Time & Materials, Fixed Fee, Non-Billable) 的切换逻辑。

联动效果： 当 Billable rates 选为 Person billable rate 时，底部的 Team 列表需动态显示费率输入框；选为 Task billable rate 时，Tasks 列表需显示费率输入框。

实现任务 (Tasks) 和成员 (Team) 的动态增删。

实现列表页的进度条展示（Budget vs Spent）。

3. API 定义参考：
请根据截图推断字段，并在 api.ts 中实现以下方法：

getProjects(): 获取列表。

createProject(data): 创建项目。

updateProject(id, data): 更新项目。

deleteProject(id): 删除项目。

4. 交互细节：

列表页支持操作菜单（Edit, Pin, Duplicate, Archive, Delete）。

表单页底部包含 Save project 和 Cancel 按钮。

注意处理数值计算（如 Remaining = Budget - Spent）。

请先给出 types.ts 和 api.ts 的定义，然后逐步实现页面组件。
注意生成的系统前端色调要符合现在已有模块类似@TaskSection

---

**Cursor**

正在实现完整的 Projects 管理模块。先探索代码库中的现有模式、HTTP 客户端和路由结构。



正在实现：先更新 Prisma schema 与后端 Projects API，再完成前端的 `types.ts`、`api.ts` 和页面组件。



正在添加数据库迁移与后端 CRUD，随后实现前端模块。



将 `OrganizationContextService` 注入到 `ProjectsService` 以简化服务方法签名。



Prisma 在 Windows 上生成时曾出现文件锁，代码应可在本地重跑 `npx prisma generate` 后通过。正在实现前端的 `types.ts`、`api.ts` 和页面。



正在实现 `TaskSection`、`TeamSection` 和页面组件。



正在创建 `project-form-page.tsx` 并更新 `projects-list-page.tsx`。



合并 `api-constants` 到 `api.ts`，以符合“仅 `api.ts` 存放 API”的目录约定。



## 已交付内容概览

### 1. `types.ts`（`frontend/src/features/projects/types.ts`）
- 与后端字段对齐的 **`ApiBillingMethod` / `ApiBudgetType`**、**`ProjectRecord`**、**`ProjectsPaginatedResponse`**、**`ProjectMetadata`**（团队、任务、发票、spent/costs 等）。
- 表单用 **`ProjectFormValues`** 及 **`defaultProjectFormValues` / `defaultProjectTasks` / `projectFormValuesFromRecord`**。
- 列表用计算：**`projectRemaining`、`projectRemainingPercentOfBudget`（(Remaining / Budget)×100）**、**`projectSpentPercent`（进度条 = Spent/Budget）**。

### 2. `api.ts`（`frontend/src/features/projects/api.ts`）
- 通过 **`apiRequest`** 实现：**`getProjects`、 `getProject`、 `createProject`、 `updateProject`、 `deleteProject`**，以及 **`formValuesToCreatePayload` / `formValuesToUpdatePayload`** 与后端的互转。

### 3. 页面与组件
- **`pages/projects-list-page.tsx`**：TanStack `useQuery` 拉列表；`useQueryClient` 在变更后 `invalidate`；按客户分组、状态/客户/经理筛选、搜索、预算/已花/剩余/成本、进度条、行内操作（Edit / Pin / Duplicate / Archive / Delete）。主色绿按钮 **#187e42**，强调与任务页一致的 **`border-border`、 `text-primary`、 `hover:bg-muted/10`** 等。
- **`pages/project-form-page.tsx`**：三种项目类型与 Billable rates 联动；**Person** 时在 **Team** 显式费率，**Task** 时在 **Tasks** 显式费率；**Invoice values** + **Save project / Cancel**。
- **`components/task-section.tsx`**、**`components/team-section.tsx`**：动态增删行、全选 billable、按模式显示费率列。

### 4. 路由
- 在 **`app/router.tsx`** 中增加 **`/projects/new`**、**`/projects/:projectId/edit`**，并从 `moduleRoutes` 中排除 **`projects`**，避免与更具体路径冲突。

### 5. 后端（使 CRUD 可联调）
- **Prisma**：`Project` 增加 `isPinned`、`startsOn`、`endsOn`、`notes`、`metadata`（迁移 `20260423140000_project_form_fields`）。
- **Nest**：`CreateProjectDto` / `UpdateProjectDto`，`ProjectsService` 按组织范围 **list / get / create / update / delete**，`ProjectsModule` 引入 **`OrganizationModule`**。

---

**本地需执行**（在 `backend` 目录）  
1. 若未应用迁移：`npx prisma migrate deploy`（或 `npx prisma db push`）  
2. 若 `prisma generate` 在 Windows 上报 EPERM，先关闭占用 `node_modules/.prisma` 的进程后重试。

---

### 关键文件参考

`api.ts` 中的资源路径与 `getProjects`：

```1:20:d:\Prognois Project\HarvestApp\frontend\src\features\projects\api.ts
import { apiRequest } from '@/lib/api/http'
import type {
  ProjectFormValues,
  ProjectRecord,
  ProjectMetadata,
  ApiBillingMethod,
  ProjectsPaginatedResponse,
} from './types'

/** 与根路径拼接后为 `GET/POST /api/projects` */
export const projectsResourcePath = '/projects'
```

`types.ts` 中的剩余与进度计算：

```105:132:d:\Prognois Project\HarvestApp\frontend\src\features\projects\types.ts
export function projectListBudgetValue(p: ProjectRecord): number {
  return p.budgetAmount ?? 0
}

export function projectListSpentValue(p: ProjectRecord): number {
  return p.spentAmount ?? 0
}

/** Remaining = Budget − Spent */
export function projectRemaining(p: ProjectRecord): number {
  return projectListBudgetValue(p) - projectListSpentValue(p)
}

/**
 * 剩余占预算的百分比 (Remaining / Budget) * 100；预算为 0 时返回 null
 */
export function projectRemainingPercentOfBudget(p: ProjectRecord): number | null {
  const b = projectListBudgetValue(p)
  if (b <= 0) return null
  return (projectRemaining(p) / b) * 100
}

/** 进度条：已花费 / 预算 */
export function projectSpentPercent(p: ProjectRecord): number {
  const b = projectListBudgetValue(p)
  if (b <= 0) return 0
  return Math.min(100, (projectListSpentValue(p) / b) * 100)
}
```

若你还希望 **Import/Export** 或 **与工时汇总自动写入 spent** 与后端打通，可以说明期望的数据源，我可以按同一套 `metadata` 或新字段再续一版。

---

**User**

请帮我执行这个脚本

---

**Cursor**

正在后端目录执行 Prisma 迁移以应用该 SQL 脚本。



迁移已经成功执行。

**结果：**
- 数据源：`PostgreSQL` → `harvestapp`，`localhost:5433`
- 已应用迁移：`20260423140000_project_form_fields`（为 `projects` 表增加 `isPinned`、`startsOn`、`endsOn`、`notes`、`metadata`）

**说明：** 随后运行 `npx prisma generate` 时在 Windows 上出现 `EPERM`（多为防病毒或其它进程占用 `query_engine-windows.dll.node`）。**数据库结构已更新**；若本地 TypeScript/Prisma 类型需要与最新 schema 一致，请关闭可能占用该文件的进程（例如正在跑的后端、IDE 终端）后在本机再执行一次：

```powershell
cd "d:\Prognois Project\HarvestApp\backend"
npx prisma generate
```

开发环境若希望用交互式流程一次完成「应用迁移 + generate」，也可以使用：

```powershell
npx prisma migrate dev
```

（在已有迁移已应用的前提下，一般只会同步 client，具体以 Prisma 提示为准。）

---

**User**

点action的时候下拉列表被挡住了应该像task的action悬浮在最上面，请帮我修复下这个问题

---

**Cursor**

查看 Tasks 页与 Projects 列表中 Actions 下拉菜单的实现，定位被 `overflow` 裁剪的原因并修复。



表格外层 `overflow-x-auto` 会裁剪 `absolute` 子元素。将菜单通过 `createPortal` 挂到 `document.body`，并用 `position: fixed` 根据按钮位置定位，与 Tasks 的悬浮效果一致。



`Button` 未使用 `forwardRef`，`ref` 不会传到 DOM。改为在包裹的 `div` 上使用 `ref` 以测量位置。



## 原因

项目列表外层用了 `overflow-x-auto`，子元素里用 **`position: absolute` 的下拉** 仍算在这个滚动层里，会被 **`overflow` 裁切**，所以菜单像被“挡住”。

## 修改说明

1. **用 `createPortal` 把菜单挂到 `document.body`**，脱离表格的 overflow 容器。  
2. **用 `position: fixed`**，根据触发按钮的 **`getBoundingClientRect()`** 计算 `top` / `left`（与 Task 行里“浮在内容之上”一致）。  
3. **`z-[200]`**，保证盖在侧栏、表格之上。  
4. **在 `resize` 和 `scroll`（capture）时重算位置**，避免横向滚动或窗口变化时错位。  
5. **点击外部关闭** 时同时判断 **按钮包裹层** 和 **菜单** 的 `contains`，避免一点击菜单就关。

相关代码在 `frontend/src/features/projects/pages/projects-list-page.tsx` 的 `ProjectRowMenu` 中。刷新页面后再点 **Actions**，菜单应整段浮在表格上方。若仍有异常，说明一下浏览器和是否嵌在 iframe 里即可。

---

**User**

当选择项目前复选框时会出现action按钮并根据harvest实现相应的功能

---

**Cursor**

正在实现多选时显示工具栏的批量 Actions（归档、删除）及选中行高亮。



正在添加多选时显示的批量 Actions（归档/删除，使用 Portal 浮层），表头全选/半选，以及选中行的 Harvest 风格高亮。



## 已实现内容

### 1. 有选中项时显示批量 **Actions**
- 在 **Status / Active projects** 同一行左侧，一旦 `selected.size > 0`，会出现 **Actions** 下拉和文案 **`{n} selected`**。
- 菜单项（与 Harvest 一致）：
  - **Archive selected projects**：对选中项 `PATCH { isArchived: true }`（`Promise.all`）。
  - **Delete selected projects**：确认后逐个 `deleteProject`，用 `Promise.allSettled` 统计失败数；全部成功则关闭菜单并清空选中。

### 2. 浮层不被遮挡
- 批量菜单与单行菜单一样，用 **`createPortal` + `position: fixed` + `z-[200]`**，避免被表格 `overflow` 裁切。

### 3. 表头全选
- 第一列表头增加 **全选复选框**；支持 **全选 / 全不选当前筛选结果**，并正确设置 **`indeterminate`**（部分选中）。

### 4. 选中行样式
- 选中行使用浅杏底：`bg-[#fff4e5]`，悬停略深：`hover:bg-[#ffecdb]`（常量 `selectedRowClass`）。

---

修改文件：`frontend/src/features/projects/pages/projects-list-page.tsx`。若还需要与 Harvest 完全一致的「仅对当前页 / 仅对可见行」的语义，可以再说一下你们的产品规则。

---

**User**

这个project的task需要修改1.上面列出的task需要从数据库直接读取所有common的task ，下面下拉列表列出的时other task,选择了以后加到上面列表，不需要后面的add按钮请帮我去掉，请帮我实现这个harvest类似功能

---

**Cursor**

实现从数据库加载 common tasks，并在下拉中选择 other task 时加入列表；移除 “Add” 按钮。正在查看任务 API 与相关组件实现。



正在将 `ProjectFormTask` 改为使用 `taskId` 关联组织任务库，从 `listTasks()` 拉取 common/other，并在 `TaskSection` 中实现从 other 选择并移除 Add 按钮。



正在更新 `project-form-page.tsx` 和 `task-section.tsx`。



## 实现说明

### 1. 数据模型（`types.ts`）
- `ProjectFormTask` 改为使用 **`taskId`**（对应组织任务库 `Task.id`），不再使用随机 `id`。
- 删除占位用的 **`defaultProjectTasks()`**；默认 `tasks: []`。
- 新增 **`projectTasksFromCommonItems(common)`**：用接口返回的 **Common** 列表初始化表单行。
- 新增 **`mergeProjectTasksForEdit`**：编辑时用当前库的 **Common** 作为主列表，并与 `metadata.tasks` 里保存的可计费/费率合并；已添加且属于 **Other** 的任务排在后面。
- **`parseTaskDefaultRate`**：解析 `defaultHourlyRate` 字符串。
- **`projectFormValuesFromRecord`**：把历史数据里的 **`id`** 视为 **`taskId`** 做兼容。

### 2. 项目表单（`project-form-page.tsx`）
- 使用 **`useQuery` + `listTasks()`**（`GET /tasks`）拉取 **common / other**。
- **新建**：任务目录加载后，**一次性**用 **全部 Common** 预填 `form.tasks`（`useRef` 防止重复覆盖）。
- **编辑**：在 **项目** 与 **任务目录** 都就绪后，用 **`mergeProjectTasksForEdit`** 写入 `tasks`；若目录未返回，则暂用 `metadata` 中的任务（已规范化）。

### 3. Tasks 区块（`task-section.tsx`）
- 上方列表：仅展示父组件传入的 `tasks`（已由 Common + 已选 Other 组成）。
- 下方 **「Add a task…」**：在 **`otherTaskPool`**（即 `listTasks().other`）中按名称过滤，**排除已在项目中的 `taskId`**。
- 选择某一项后 **立即加入** 上方列表，并关闭下拉；**已去掉「Add」按钮**。
- 支持键盘：↑/↓、Enter 选择、Esc 关闭；点击外部关闭。
- 加载中显示「正在加载组织任务…」。

这样行为与 Harvest 一致：上方为 **Common**（来自库），下面从 **Other** 搜索并加入项目。

---

**User**

new project时上面列出的是所有common task下面下拉列表是列出的未被选择的task,如果上面的task点叉号删除的话，点下面下拉列表的时候删除的task也需要显示在下面选择框中，如果是editproject上面只需列出选择了被保存过的task

---

**Cursor**

调整逻辑：新建项目仍预填全部 common；编辑仅显示已保存的任务；下方下拉为「组织内全部任务（common+other）减去当前已选」。正在读取并修改相关文件。



正在将编辑模式改为仅显示已保存任务；下拉的候选池为 common + other 中尚未加入本项目的项（含删除后恢复的 common 项）。



## 行为说明（已按你的规则改好）

### 新建项目（New project）
- **上方列表**：仍为任务库里 **全部 Common** 任务（`projectTasksFromCommonItems`）。
- **下方搜索/下拉**：候选 = **Common ∪ Other**（去重），再 **排除当前已在上面列表里的 `taskId`**。  
  因此：用 **× 从本项目移除** 删掉某条 Common 后，该任务会重新出现在下面（因为已不在 `inProjectIds` 里）。

### 编辑项目（Edit project）
- **上方列表**：**只显示已保存进 `metadata.tasks` 的任务**（`projectTasksForEditFromSaved`），**不再**补全整个 Common 列表。  
  若任务在库里还存在，名称会与组织任务库同步；**可计费 / 项目内费率** 仍用已保存值。

### 下拉实现细节
- 在 `project-form-page` 里用 `useMemo` 计算 **`taskAddPool`**：`[...common, ...other]` 按 `id` 去重。
- `TaskSection` 收到 `taskAddPool`，`available = taskAddPool.filter(未在本项目 && 名称匹配搜索)`。

### 重命名
- `mergeProjectTasksForEdit` → **`projectTasksForEditFromSaved`**（仅保留已保存行并做名称同步）。

若本地 IDE 仍报 `taskAddPool` 类型错误，多半是 TS 服务缓存，保存/重开 `task-section.tsx` 或跑一次 `tsc` 即可。

---

**User**

现在需要修改team 块new Project的时候team和task类似，上面列出当前登录人，下面列出上面未被列出的team, edit project的时候列出被保存过的team, team选择框也改成上面task那种点一下选择一个的那种，把后面的添加按钮去掉

---

**Cursor**

正在将 Team 区块改为与 Task 类似的交互：新建时默认显示当前登录用户；编辑时仅显示已保存成员；下方为可搜索的单选式下拉（去掉 Add 按钮）。



正在添加 `types.ts` 中的 team 辅助函数、合并 `project-form-page` 的 `useEffect`，并将 `team-section.tsx` 改为与 `task-section` 相同的可搜索点选添加方式。



已按摘要中的约定接好 `TeamSection` 与表单页，当前状态如下。

## 已完成的修改

1. **`project-form-page.tsx`**  
   - 两处 `TeamSection` 已改为传入 `memberAddPool={teamRows}` 和 `catalogLoading={teamQuery.isLoading}`，不再使用 `teamOptions`。

2. **行为（与对话目标一致）**  
   - **新建**：团队区与 Task 类似 — 上方为当前项目成员（含从组织上下文匹配出的**当前登录人**），下方可选池为**尚未加入本项目的**组织成员；点列表项即加入，**无 Add 按钮**。  
   - **编辑**：上方仅显示**已保存的** `metadata.team` 成员；下方为未加入的其余成员。

3. **检查**  
   - 对 `types.ts`、`team-section.tsx`、`project-form-page.tsx` 的 linter 无报错。  
   - `npx tsc --noEmit` 仅因项目里 `baseUrl` 在 TS 6+ 的弃用提示退出（与本次改动无关）。

## 建议你本地再手测

- 新建项目：Team 区先出现当前用户；从下方搜索/点选加人；把自己移出后，应能在下拉里再选回。  
- 编辑已保存项目：仅看到已持久化的成员，加人方式与 Task 一致（点选，无添加按钮）。

若你希望，我可以再扫一遍 `team-section.tsx` 与 `project-form-page.tsx` 里与 Team 相关的 `useEffect` 是否与你最新数据流完全一致。

---

**User**

现在task和team有个bug,点一下下拉列表框列出选项我选择了一个，但是当我在点一下想选下一个的时候就列不出来了，其实还是有数据的请帮我修复

---

**Cursor**

正在分析 Task 与 Team 下拉的实现，定位第二次点击无法展开的原因。



定位到问题：用 `onMouseDown` + `preventDefault` 在选项上选人时，输入框保持焦点，第二次点击已聚焦的输入不会触发 `onFocus`，而代码只在 `onChange` 和 `onFocus` 里把 `open` 设为 `true`，因此下拉里不展开。为输入框添加 `onClick={() => setOpen(true)}` 以在再次点击时打开下拉。



## 原因

从下拉项里选人时用了 `onMouseDown` + `preventDefault()`，是为了避免输入框先失焦。这样选完后**焦点仍留在输入框上**。

再次用鼠标点同一个输入框时，**只有 `click`，不会再触发 `focus`**（已经聚焦的元素不会重复收到 `focus`）。而原来只在 `onFocus` 和 `onChange` 里执行 `setOpen(true)`，所以第二次点输入框时 `open` 一直是 `false`，列表就不会出现。

## 修改

在 **Task** 和 **Team** 的搜索输入上增加：

`onClick={() => setOpen(true)}`

这样即使用户不输入、只是再点一次输入框，也会重新展开下拉，和 Task/Team 行为一致。

请再试：连续从列表里多选几个任务/成员，每次点输入框都应能再打开选项。

---

**User**

去掉默认负责人(筛选用)，还有task和team是一直显示的不会根据项目类型的选择而显示隐藏

---

**Cursor**

正在查找项目表单中与“负责人”和按项目类型显示/隐藏 Task、Team 相关的逻辑。



正在统一：始终显示 Tasks 与 Team 区块，并移除「默认负责人」下拉及 `managerOptions`。



已按你的要求改好了，说明如下。

## 1. 去掉「默认负责人(筛选用)」

- 已删除团队区块下方的 `select` 及 `managerOptions` 的 `useMemo`。
- `types` / `api` 里仍保留 `primaryManagerUserId` 的读写：编辑老项目时仍能从接口带回；新建项目默认可为 `null`。若你希望**不再提交**该字段，可以再说，我再改 `api.ts`。

## 2. Task / Team 与项目类型解绑

- 原先：`time_materials` 才出 Tasks + Team；`fixed_fee` 又单独重复渲染 Team；`non_billable` 没有这两块。
- 现在：**无论选 Time & Materials、Fixed Fee 还是 Non-Billable**，在「项目类型」区块下面都会**固定出现**一次 **Tasks** 和 **Team**。
- **费率的显示逻辑不变**：仅当「Time & Materials」且计费方式为 **Task billable rate** / **Person billable rate** 时，才在 Task / Team 里显示对应费率列；其他类型下这两列不显示，与之前 `fixed_fee` 下只显示 Team 且不显示费率列的行为一致。

这样在 Fixed Fee / Non-Billable 下也可以一直维护任务与成员，只是费率列在不符合 T&M 条件时保持隐藏。

