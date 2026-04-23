# Timesheet and expense approvals
_Exported on 2026/4/23 at GMT+8 17:34:44 from Cursor (3.1.14)_

---

**User**

项目成员提交time / expenses以后，项目管理员可以在 Approvals 中进行审核。前端代码放在  @approvals，后端代码在 @modules 
中加个 approvals 目录，前端页面见第一个截图，包括上中下三部分：
1. 最上面一排左边是查询time / expenses的日期范围，包含一个 Day/Week/Semimonth/Month/Quarter/Custom 的下拉框，默认选中 Week，下拉框数据通过枚举定义 @HarvestApp/backend/prisma/schema.prisma:380-434 。其后面是对应下拉框选择内容的日期范围，并提供左右箭头按下拉框选择内容切换。接着是一个 Return to this xxx的快捷连接，用于快速切换会当前日期对应的日期范围。
	上面一排的右侧是两个下拉框：左边一个是 time / expenses 的状态下拉框，内容也是通过枚举定义，右边是 Group By 的下拉框： Person/project/Client，下拉框内容也是通过枚举定义
2.中间部分包含两部分，上面是一排用于过滤数据的下拉框，包括：Client, Project, Role, Teammate，每个下拉框包含 Select All 以及具体的 Client, Project, Role, Teammate，支持多选， 点 Select All就选中所有，选中的内容要显示在这排下拉框下面，最后要加个 Clear all filters 的连接，可以清除所有过滤条件。
	中间下面部分是根据第1部分选择的时间范围，状态，group by条件，以及中间部分选择的 Client, Project, Role, Teammate 查询总的时间 及 总的费用，分别显示在左边和右边，具体可参考截图
4.下面部分显示根据上的过滤添加查询返回的每行记录，包含内容见截图，每行都要提供 Send email 和 Approve 按钮， Approve以后，该time/expenses被lock，将不能再进行修改。可以withdraw time/expenses approval，撤销以后，成员可以重新进行修改提交.
 最下面提供一个 “Approve visible timesheets and expenses”按钮，可以异常将页面中显示的所有查询结果一次全部 Approve。
代码中用英文不要出现中文

---

**Cursor**

正在实现 Approvals 功能：先探索 HarvestApp 的代码结构与数据模型。



正在实现：将后端中的中文错误信息改为英文，并构建完整的前端 Approvals 页面与 API 封装。



正在实现：先更新后端的英文错误信息，并添加前端的 `api.ts`、`period.ts` 与完整页面。



正在添加 `api.ts`、`period.ts` 和完整页面实现。



正在实现完整的 `approvals-page.tsx`。



修复错误：移除错误代码、修正 busy 状态与货币显示，并清理未使用的导入。



## 已完成内容

### 后端（`backend/src/modules/approvals`）
- 将 `requireApprover`、日期范围、`approve` / `approve-all` / `withdraw` 等错误与注释改为**英文**。
- **修复 Prisma 关系名**：`User` 上应为 `organizations`，不是 `userOrganizations`（否则 `tsc` 不通过）。
- `notifyGroupStub` 的提示、DTO 中 `parseUuidList` 的错误信息、Controller 的 Swagger `summary` 均改为**英文**。

### 前端（`frontend/src/features/approvals`）
- 新增 `api.ts`：封装 `GET /approvals/meta|filters`、列表查询、`approve`、`approve-all`、`withdraw`、`notify`，并带上 `X-Organization-Id`（与现有 `fetchOrganizationContext` 一致）。
- 新增 `period.ts`：按 `ReportPeriod`（`DAY` / `WEEK` / `SEMIMONTH` / `MONTH` / `QUARTER` / `CUSTOM`）计算区间、上/下一区间、`Return to this week` 等快捷回当前区间；周为**周一起算**（与参考截图一致）。
- 重写 `pages/approvals-page.tsx`：上栏（时间粒度、范围、左右箭头、**Return to this …**、状态、按 Person/Project/Client 分组）、中栏（Client/Project/Role/Teammate 多选 + **Select all** + 橙色标签 + **Clear all filters**）、汇总卡（总工时 / 总费用 + 可计费占比条）、下表（头像、**Send email**、**Approve**、有已批准项时 **Withdraw**）、**Approve visible timesheets and expenses**。仅 **Administrator / Manager** 可进入，否则显示英文无权限说明。

### Prisma
- `ReportPeriod` 与 `ApprovalsGroupBy` 已在 `schema.prisma` 中；若本地尚未应用迁移，请在 `backend` 中执行 `npx prisma migrate deploy`（或开发环境用 `prisma migrate dev`）。

已验证：`frontend` 的 `npm run build` 与 `backend` 的 `npx tsc --noEmit` 均通过。

---

**User**

几个问题需要改一下：
1.页面样式要可以参考 Tasks，页面风格样式是偏蓝色的，比如“Approve visible timesheets and expenses”按钮
2.页面显示有几个地方要改一下，上面部分显示日期范围的地方，看着日期范围前后各有一条垂直的虚线，要去掉， 
上面部分右侧Status 和 Group by文字要和下拉框在一条水平线上，不要换行显示
中间的“Clear all filters”只在选择了Filter时才显示，不选就隐藏
中间Total time 和 Total expenses 这两部分的右侧都有一块浅蓝色，这部分是显示什么的，如果没有内容就不用显示

---

**Cursor**

对照 Tasks 页面样式并修改 Approvals 页面的这些问题。



正在应用这些修改：参考 Tasks 的蓝色主按钮与排版，移除日期两侧的虚线、将 Status/Group 与标签同行、仅在有过滤时显示 “Clear all filters”，并在无数据时隐藏汇总区右侧的迷你条形图（或改为主题色逻辑）。



## 已按 Tasks 风格与反馈改动的点

### 1. 整体与主按钮（偏蓝、对齐 Tasks）
- 标题使用与 Tasks 相同的 `text-2xl font-semibold tracking-tight`；内容区增加 `mx-auto max-w-6xl`。
- **「Approve visible timesheets and expenses」** 改为默认的 `Button`（`variant` 默认 = 主题 `primary` 蓝），并加上与「New task」类似的 `h-9`、在窄屏全宽 / 宽屏 `sm:w-auto`。
- 汇总里可计费/不可计费色块、表格里可计费工时条改为 `bg-primary` / `bg-primary/10` 等，与主色一致。

### 2. 日期范围两侧虚线
- 去掉 `border-x border-dashed border-border`，只保留内边距与图标+文字，不再出现两侧竖虚线。

### 3. Status / Group by 与下拉同一行
- 由「标签在上、下拉在下」改为同一行：`flex items-center gap-2`，并给 `<select>` 加了 `id` + `<label htmlFor>`，保证可访问性。

### 4. 「Clear all filters」
- 仅当任意 Client / Project / Role / Teammate 有选中项时显示；全未选时隐藏。
- 与四个筛选项同一行：右侧 `justify-between`，小屏时换行仍合理。

### 5. Total time / Total expenses 右侧浅蓝块
- 含义是 **可计费占比条**（与下方文字中的 Billable 比例一致）。
- 当 **总工时为 0** 或 **总费用为 0** 时不再渲染右侧条，避免出现空白浅蓝块；有数据时用主色条并加了 `title`（`Share of billable hours` / `Share of billable expenses`）方便悬停理解。

若你还希望左侧 **Time period** 也严格与右侧一样「标签+下拉同一行」的栅格，当前它们已在同一 `flex-wrap` 里同一行排列；若要再收紧断行行为，可以再说一下目标断点。

