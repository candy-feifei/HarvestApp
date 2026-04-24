# HarvestApp Timesheet 模块需求说明

## 1️⃣ 业务目标
允许用户记录每天在不同项目、任务上的工作时间，支持后续报表与计费。

---

## 2️⃣ 核心实体（Entity）
- User
- Project
- Task
- TimeEntry（核心）

---

## 3️⃣ TimeEntry 数据结构（基于 Prisma）
请参考 backend/prisma/schema.prisma

字段至少包含：
- id
- userId
- projectId
- taskId
- date（工作日期）
- hours（工时，支持小数）
- notes（备注）
- isLocked（是否已锁定/提交）
- createdAt
- updatedAt

---

## 4️⃣ 功能点拆解（请逐个实现）

### ✅ F1：记录工时（Create）
- 用户选择项目 / 任务
- 输入日期 & 工时
- 提交后写入 time_entries 表
- 同一天、同一任务不可重复（或合并）

---

### ✅ F2：查看 Timesheet（Read）
- 按周 / 按月查看
- 显示：
  - 日期
  - 项目
  - 任务
  - 工时
  - 备注
- 支持切换视图（周视图 / 月视图）

---

### ✅ F3：编辑工时（Update）
- 仅允许编辑未锁定的记录
- 修改工时 / 备注
- 自动更新 updatedAt

---

### ✅ F4：删除工时（Delete）
- 仅允许删除未锁定记录

---

### ✅ F5：锁定 / 提交 Timesheet
- 用户可“提交本周工时”
- 提交后 isLocked = true
- 锁定后禁止编辑

---

### ✅ F6：审批（可选，进阶）
- Admin / Manager 可审批 Timesheet
- 状态流转：
  open → submitted → approved

---

## 5️⃣ API 设计约定
请使用 Next.js App Router（app/api/...）

示例：
- POST   /api/time-entries
- GET    /api/time-entries?week=2026-04-21
- PATCH  /api/time-entries/:id
- DELETE /api/time-entries/:id

---

## 6️⃣ 权限规则
- 普通用户：只能操作自己的 TimeEntry
- Admin：可查看 / 审批所有 TimeEntry
- 使用 Supabase / Prisma RLS 或中间件控制

---

## 7️⃣ UI 要求
- 类似 Harvest 的 Timesheet 页面
- 左侧项目 / 任务
- 顶部日期列
- 单元格可输入工时
- 自动汇总每日 / 每周工时

---

## 8️⃣ 技术栈
- Next.js 14+
- Prisma ORM
- Supabase Postgres
- Tailwind + shadcn/ui
- TypeScript

---

## 9️⃣ AI 输出要求
请：
1. 先输出 Prisma schema（如尚未存在）
2. 再输出 API 路由代码
3. 最后输出 React 页面组件