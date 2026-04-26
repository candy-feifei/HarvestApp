# Time and profitability reports
_Exported on 2026/4/26 at GMT+8 15:39:24 from Cursor (3.1.14)_

---

**User**

现在需要实现一下 Reports 功能，包含两个Tab：
1.Time Tab：这是time report，可以按照各种条件筛选，例如，可以按照Clients来统计，可以按照Projects来统计，可以按照Tasks来统计，还可以按照Team来统计。
	截图中的 ‘Detailed report’不需要，Export 可以导出Excel和pdf
2.Profitability Tab：这是profitability report。
	Profit = Revenue – Costs
	Revenue = 小时数*rate
	Costs = Expenses
具体效果实现见截图，
页面风格样式是偏蓝色的参考其他模块，代码中用英文不要出现中文，前后端代码位置 @reports @reports 

---

**Cursor**

正在探索 HarvestApp 的现有结构与 reports 模块，以便实现 Time 与 Profitability 两个报表 Tab。



正在实现：先添加后端 `ReportsService` 与 DTO、再到前端页面与导出。



正在实现后端服务、DTO 与控制器，随后构建前端页面及导出功能。



正在简化并修复 `getProfitabilityReport`：原实现中费用按 task 分配的逻辑存在错误与多余变量。



正在修复 Time 汇总中可计费小时数统计，并清理 Profitability 中任务维度的费用分配逻辑。



正在实现主页面 `reports-page.tsx`。



以下是本次实现的概览（界面与代码为英文，说明用中文）：

## 实现说明

### 后端（`F:/AI/code/HarvestApp/backend/src/modules/reports`）
- **`GET /api/reports/filters`**：筛选选项（客户、项目、任务、团队、项目类型、经理等）。
- **`GET /api/reports/time`**：时间报表。参数：`fromYmd`、`toYmd`、`groupBy`（`clients` | `projects` | `tasks` | `team`）、`activeProjectsOnly`、多选 `clientIds` / `projectIds` / `userIds` / `taskIds`（逗号分隔）。
- **`GET /api/reports/profitability`**：盈利报表。在上面的日期范围上增加 `currency`、`projectStatuses`（`active,archived`）、`projectTypes`（`TM,FIXED_FEE,NON_BILLABLE`）、`projectManagerUserIds`。

**业务逻辑：**
- **可计费收入**：`billable hours ×` 按优先级解析的小时费率：任务 `hourlyRate` → 项目 `hourlyRate` → 成员工资 `projectBillableRate` → 成员工资历史与日期匹配。
- **时间报表摘要**：可计费/不可计费小时、可计费金额、未开票（发票数据暂无时，未开票=可计费合计）。
- **盈利报表**：`Revenue = 上述可计费小时 × 费率`，`Cost = 费用`（仅 `Expense`），`Profit = Revenue - Cost`。**不计**工时成本。按月汇总用于图表。  
- **按 Tasks 分组的费用**：将项目费用在项目的 `ProjectTask` 上均分；无任务时记到行 **“Project (no tasks) expenses”**。

### 前端（`F:/AI/code/HarvestApp/frontend/src/features/reports`）
- **报表页**（`pages/reports-page.tsx`）：仅 **Time**、**Profitability** 双标签；周/日/月/等周期与 Approvals 共用 `approvals/period`。
- **时间**：多选筛选、仅活跃项目、摘要卡（总工时、环图、可计费/不可计费、可计费与未开票金额）、子表 **Clients / Projects / Tasks / Team**、横向进度条、Team 的 **Utilization**。
- **盈利**：项目状态/类型/经理/货币、缺失费率黄条、月度柱状条（绿收入 + 红成本）、三栏摘要、子表 + **Profit** 小条 + **Return on cost**；无 “Detailed report” 按钮。
- **导出**（`reports-export.ts`）：**Excel 使用 UTF-8 CSV**（Excel 可打开），**PDF** 用 `jspdf` + `jspdf-autotable` 生成表格。打印按钮调用 **浏览器打印**（整页；用户可调 “另存为 PDF”）。
- **Save report**：将当前 `localStorage` 中偏好写入（轻量记忆）。

为通过现有严格 `tsc` 构建，顺带去掉了 `projects-list-page.tsx` 里未使用的 `setManagerId` 与 `managersInList` 块（否则 `npm run build` 会失败）。

## 使用方式
- 在导航进入 **Reports**，切换 **Time** / **Profitability**，用顶部周期与多选筛数据，在 **Export** 中选 **Excel (CSV)** 或 **PDF**。

若你希望 “Save report” 真正保存到服务器，或把打印缩成**仅表格区域**、盈利图增加 **Profit 折线叠在柱上**，可以说明一下优先做哪一块。

---

**User**

我测试了上面生成的代码，发现盈利的月度柱状图显示有问题，见截图

---

**Cursor**

正在查看盈利图表的当前实现。问题在于用 `flex-grow` 模拟柱高：当 `flex: 100 0 auto` 时，子项会占满整列的可用空间，在单月且仅有成本时看起来像整图被填满。我们改用显式的 `height: X%` 在固定高度容器内堆叠，并加一条基线/留白。



定位到问题：使用 `flex: 100 0 auto` 时，第一个值是 `flex-grow`（数字 100），不是“百分比高度”，会导致单柱占满；且 `flex-1` 的列在单月时会占满整行宽度。将改为在固定高度容器内用明确的 `height: X%` 与固定柱宽（例如 `w-10` 居中）绘制堆叠柱。



## 原因说明

1. **`flex` 写错了**  
   用了 `style={{ flex: \`${cH} 0 auto\` }}`（例如 `flex: 100 0 auto`）。在 CSS 里这表示 **`flex-grow: 100`**，不是「高度 100%」。在列里子项会按 **flex 增长** 占满整段高度，看起来像整片色块。

2. **柱太宽**  
   每一列用了 `w-full`，只有一个月时整行都是「一根」宽柱，整图会被铺成一条粉/红带。

## 修改方式

- 在 **`relative h-40` 的绘图区**里，用 **`absolute bottom-0 left-1/2 w-9 -translate-x-1/2`** 做**固定宽度、居中**的柱（约 `2.25rem`），避免占满全宽。  
- 用 **`height: (revenue + costs) / chartMax * 100%`** 作为整段柱的**总高度**（相对绘图区），再在内部用  
  `revenue/tot` 和 `costs/tot` 的 **百分比高度** 做**绿/红堆叠**（`tot = revenue + costs`）。  
- 绘图区加了浅灰底 **`bg-slate-50/50`**，并加了一行说明本次 **纵轴用的最大值**（`chartMax`），读数更清楚。  
- 无数据时画一条细灰线占位。

这样在你这种 **只有成本 $20、收入 $0、单月** 的情况下，会显示为**中间一条窄的粉色柱**占满当月的纵轴比例，而**不会**再铺满整张图。请再刷新页面验证一下。若还希望加 **Y 轴刻度线** 或 **Profit 折线叠在柱上**，可以再说。

