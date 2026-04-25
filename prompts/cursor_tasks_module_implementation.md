# Tasks module implementation
_Exported on 2026/4/25 at GMT+8 12:42:21 from Cursor (3.1.14)_

---

**User**

我现在有个新项目，是参照harvestapp实现的一个时间管理系统，框架已经搭建好了，数据库结构也已经创建了@migration.sql ，现在需要实现各个模块前后端功能，首先先实现 “任务”（Tasks） 模块功能，后端代码放在@tasks  ，前端代码放在 @tasks  目录中，
任务模块用来管理企业的tasks,分为Common tasks和Other tasks。
Common tasks在新建project时，会自动将这些tasks添加到project中。Other tasks需要用户手动添加到project中。
可以将common tasks改为other task，也可以将other task改为common task。
可以新增task，也可以Edit/Archive/Delete某个task。
参照下面的截图实现，页面风格要按当前项目的偏蓝色风格，可参考 客户 模块 @clients 

---

**Cursor**

正在分析项目结构与数据库迁移，随后实现“任务”模块的前后端功能。



正在实现：在 `tasks` 表添加 `isBillable` 和 `defaultHourlyRate`（与截图中的默认可计费/默认费率一致），并完成后端与前端实现。



正在实现 Service、DTO 和 Controller。



调整路由顺序：将 `POST batch/archive` 置于 `POST :id/archive` 之前，避免 `id` 被误解析为 `batch`。



正在实现前端的 `api.ts` 与 `tasks-page.tsx`。



修复：编辑时未更改费率时不应把 `defaultHourlyRate` 置为 `null`；在 `TaskBlock` 为空时仍显示区域标题与提示。



## 实现说明

### 数据库
- 在 `tasks` 表增加 **`isBillable`**（默认 `true`）和 **`defaultHourlyRate`**（可空），与「默认可计费 / 默认时薪」一致。
- 迁移文件：`backend/prisma/migrations/20260423120000_add_task_billing_fields/migration.sql`  
- `schema.prisma` 中 `Task` 模型已同步。

**部署前请在 `backend` 执行**（任选其一）：

`npx prisma migrate deploy` 或 `npx prisma migrate dev`  
若本机 `prisma generate` 因文件占用报 EPERM，可关闭占用的 Node 进程后重试。

### 后端（`backend/src/modules/tasks/`）
- **`TasksService`**：列表（按 `q` 筛选，拆成 `common` / `other`）、单条、创建、更新、归档、删除、批量归档、CSV/JSON 导出。
- **`attachCommonTasksToNewProject(organizationId, projectId)`**：把当前组织下所有**未归档的 Common 任务**加入新项目；`TasksModule` **已 export** `TasksService`，供以后「创建项目」时注入调用。
- **删除**：若任一条 `project_task` 上已有**工时**则拒绝，提示先归档；否则先删 `project_tasks` 再删 `Task`。
- **「加入所有已有项目」**：在创建/更新时勾选，会为该组织下**未归档项目**补建 `project_tasks`（已存在则跳过）。

### 路由要点（避免与 `id` 冲突）
- `GET /api/tasks/export` 在 `GET :id` 之前。
- `POST /api/tasks/batch/archive` 在 `POST :id/archive` 之前。

### 前端（`frontend/src/features/tasks/`）
- **`api.ts`**：封装 CRUD、批量归档、带鉴权的导出下载。
- **`tasks-page.tsx`**：与客户页一致的 **主色/布局**；过滤、两栏 **Common / Other**、行内 **Actions**（编辑、在 Common/Other 间移动、归档、删除）、**批量归档**、**Export（CSV/JSON）**、顶栏 **新建任务** 与内联表单（浅蓝底框）。

### 后续衔接：新建项目时挂 Common 任务
当前代码库**尚未**实现 `Project` 的 `create`。实现创建项目时，在事务成功写入 `Project` 后增加一行即可，例如：

`await this.tasksService.attachCommonTasksToNewProject(orgId, newProject.id)`  
（在 `ProjectsModule` 中 `import { TasksModule }` 并注入 `TasksService`。）

---

**User**

我测试有个问题，在tasks的列表页面上，如果列表记录数比较少，当点击每行最后的 Actions，展开的下拉框显示不全，被列表框挡住了。另外将 Export 和 新建任务 这两个交换一下位置，新建任务在左边

---

**Cursor**

修复 Actions 下拉被父容器裁切，并交换「新建任务」与「Export」按钮顺序。



移除列表卡片的 `overflow-hidden`（它会裁切 `absolute` 下拉菜单），并将 Actions 下拉的 `z-index` 提高；接着交换「新建任务」与「Export」的顺序。



### 原因说明
列表外层的白底卡片使用了 **`overflow-hidden`**，用来配合圆角裁切内容，但会把每行里 **`position: absolute`** 的 Actions 下拉一起裁掉，所以记录少、下拉往下展开时就像被「框」挡住了。

### 修改说明
1. **去掉列表容器的 `overflow-hidden`**，改为 **`overflow-visible`**，让下拉可以画出卡片边界；圆角仍由外层 `rounded-md` + 边框表现，视觉上与原来一致。
2. **Actions 菜单**把 **`z-index` 提到 `z-[100]`**，并略加重阴影，避免被下方区块盖住。
3. **按钮顺序**：右侧工具区改为先 **「新建任务」**，再 **「Export」**（大屏时左/右顺序对应「新建」在左、「导出」在右）。

若你在某条紧贴视口底边的行上仍感觉菜单被裁切，多半是外层 `main` 的 `overflow-auto` 在滚动区域边界上的表现；那时可以再改成用 **Portal + fixed** 挂到 `document.body`。当前场景按上述修改一般即可。

---

**User**

请将上面生成的Tasks相关代码中的中文全部替换成英文

---

**Cursor**

正在将 Tasks 模块中所有中文替换为英文，先搜索相关文件中的中文内容。



正在将 backend 与 frontend 的 Tasks 相关文件中的中文全部改为英文。



正在批量替换：先更新后端文件，再更新 `tasks-page.tsx`。



已将 `features/tasks` 与 `modules/tasks` 内中文全部替换。侧栏中 Tasks 的导航仍为中文，正在将该项改为英文以保持一致。



### 已改为英文的范围

1. **Backend** `backend/src/modules/tasks/`  
   - `create-task.dto.ts` / `update-task.dto.ts`：`@ApiProperty` 说明、校验错误信息  
   - `tasks.controller.ts`：`@ApiOperation` / `@ApiQuery` 文案  
   - `tasks.service.ts`：`NotFoundException` / `BadRequestException` 提示、JSDoc 注释  

2. **Frontend** `frontend/src/features/tasks/`  
   - `pages/tasks-page.tsx`：页面标题、按钮、表单、空状态、确认框、行内错误、Actions 菜单、区块说明、批量操作等全部用户可见文案  

3. **侧栏**（与 Tasks 入口一致，避免仍显示「任务」）  
   - `frontend/src/lib/nav-config.ts` 中 `id: 'tasks'` 的 `title` / `description` 已改为英文。

`frontend/src/features/tasks/api.ts` 中本身没有中文，未改。

若你还希望 **整站** 导航或其它模块也统一英文，可以说明范围再改。

---

**User**

@HarvestApp/frontend/src/features/tasks/pages/tasks-page.tsx:192-210 在 Move to Other tasks 或者 Move to Common tasks 的前面再加一个 'Add to all projects' 并实对应的现后台功能，实现将该task关联到所有project上的功能，

---

**Cursor**

我会在每行 `Actions` 下拉里新增 **“Add to all projects”** 菜单项，点击后调用后端现有的 `PATCH /tasks/:id`（`addToAllExistingProjects: true`）来把该 task 关联到所有未归档项目上，并保持当前列表刷新与错误提示一致。接下来直接修改 `tasks-page.tsx`。

已在 `Actions` 下拉菜单里加上 **“Add to all projects”**，并接到后端现有功能：点击后会调用 `updateTask(task.id, { addToAllExistingProjects: true })`，把该 task 关联到组织内**所有未归档项目**（已存在的关联会跳过），然后自动刷新列表。

改动在 `frontend/src/features/tasks/pages/tasks-page.tsx` 的 `TaskRow` 内：
- 新增菜单项：**Add to all projects**
- `run()` 增加 `addAll` 分支并带确认框

另外我跑了前端 build，报错来自 `projects-list-page.tsx` 的未使用变量（与本次 tasks 改动无关）。如果你希望我顺手把这两个 TS6133 也修掉，我可以继续处理。

---

**User**

上面修改我测试数据正常保存到了 project_tasks 表，但是在 @task-section.tsx 中没有显示已添加的task，看看是什么问题

---

**Cursor**

我先查看 `task-section.tsx` 里任务列表的数据来源与筛选逻辑（尤其是是否只显示“已手动添加”的某类记录、是否按 `projectId`/`taskId` 关联字段取值、以及缓存 key 是否需要刷新），再对齐后端返回结构来修复显示问题。

问题原因找到了：`task-section.tsx` 显示的是 **project 的 `metadata.tasks`**（项目表里的 JSON），而你点 “Add to all projects” 只写入了 **`project_tasks` 表**，没有同步更新每个项目的 `metadata.tasks`，所以 UI 仍然看不到。  
我接下来会在后端把「批量关联到所有项目」时同时把对应 task 追加到各项目的 `metadata.tasks`，这样项目编辑页会立刻显示。

问题原因是 **`task-section.tsx` 显示的数据来源不是 `project_tasks` 表**，而是项目表里的 **`projects.metadata.tasks`（JSON）**。  
你点 “Add to all projects” 之前只写了 `project_tasks`，所以项目编辑页仍然读不到新增任务。

### 已修复
我已在后端把「Add to all projects」的逻辑改成 **同时**：
- 插入 `project_tasks`
- 并把该任务追加到每个项目的 `metadata.tasks`（若已存在则不重复）

改动文件：`backend/src/modules/tasks/tasks.service.ts`  
现在你再执行一次 “Add to all projects”，回到项目编辑页，`task-section.tsx` 就会显示新增的 task 了。

如果你希望对**历史已写入 `project_tasks` 但未写入 `metadata`** 的数据做一次性补齐，我也可以加一个后台脚本/接口来批量同步。

