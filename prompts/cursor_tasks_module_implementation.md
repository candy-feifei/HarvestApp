# Tasks module implementation
_Exported on 2026/4/23 at GMT+8 13:40:25 from Cursor (3.1.14)_

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

