# Expenses data model
_Exported on 4/23/2026 at 15:16:16 GMT+8 from Cursor (2.6.22)_

---

**User**

在frontend和backend这两个项目中添加下面的内容  
# Task
请在 `src/features/expenses/` 目录下生成相关功能代码，包含 pages、components 与 api.ts。

# Technical Stack & Standards
1. 目录结构：遵循现有的模块化规范。
2. 数据请求：统一使用 `src/lib/api/http.ts` 中的 `apiRequest`。
3. 状态管理：列表类数据必须使用 TanStack Query (@tanstack/react-query)。
4. 类型定义：在 api.ts 中定义清晰的 Request 和 Response 类型。

- api.ts: 定义 CRUD 接口。
- components/: 生成费率设置表单（需包含时间范围选择）和费用列表组件。
- pages/: 费用报销主页面及费率配置页面                  
- 加上你对harvest的了解结合我的截图

---

**Cursor**

正在探索项目结构、Prisma 数据模型与现有 API 模式，以实现费用报销与费率配置功能。



Prisma `ExpenseCategory` - only has id, name, unitName, unitPrice, isArchived, organizationId - no updatedAt. Good.

For `ExpenseCategoryRate` I'll add createdAt, updatedAt with default.

Now update schema.prisma with all changes at once.

Also need to add `@@index` in Prisma for the new model.

**Delete expense:** soft or hard? Categories use archive. For expenses, DELETE is fine if not locked.

**List expenses with approval:** include approval: { select: { status: true, periodStart, periodEnd } }

For weekly group "status" on the header - if all expenses in week share same approval - complex. Simpler: show per-line status from entry status; group header can show "mixed" or derive from first item. UI shows "Pending approval" for the week - I'll use the max status in group: if any SUBMITTED, show pending, etc. Frontend groups by week and computes.

**Form options endpoint:** 
```
GET /api/expenses/form-options
{ projects: ProjectOption[], categories: ExpenseCategory[] }
```

**List expenses:**
```
GET /api/expenses?userId=&from=&to=
```

Default userId = current user if not specified (managers can filter). For non-managers, ignore userId filter? Simpler: always allow filter if in same org (all members can see all team expenses for manager view - actually Harvest: teammates filter shows others' expenses). Any org member can query another member's id if same org.

Implement list with:
```typescript
where: {
  user: { id: userId filter },
  project: { organizationId: m.organizationId },
  spentDate: { gte, lte } optional
}
```

**Create expense:** userId = current user (can't create for others from API for now, unless admin - skip for MVP)

**Update/Delete:** only own expense or admin - for MVP only owner

Let me implement.

**Prisma client** after schema change - run generate

**Frontend VITE** - path /api

I'll add `link` in expenses page to rate config: react-router `Link to="/expenses/rate-config"`

Update router: add child routes. The module route is flat - `path: 'expenses'` - I need to add `expenses/rate-config` as separate before the catch-all. In react-router v6, order matters - more specific first:

```javascript
{ path: 'expenses/rate-config', element: <ExpenseRateConfigPage /> },
{ path: 'expenses', element: <ExpensesPage /> },  // from module routes
```

Actually module routes map from nav - `expenses` is one path. I'll add explicit route in router children **before** `...moduleRoutes` for `expenses/rate-config` and also need `expenses` to NOT catch `expenses/rate-config` - the path `expenses` is exact in moduleRoutes: `path: 'expenses'` only matches /expenses, not /expenses/rate-config. Good.

List children order - put `expenses/rate-config` before `...moduleRoutes` to be safe (though no conflict).

Add lazy import for ExpenseRateConfigPage.

**Categories tab** - can be route `expenses/categories` or query param. Simpler: state in ExpensesPage with `tab` = 'all' | 'categories'. User image shows tabs in same page. I'll use state tabs without extra route for categories, and separate route only for rate config.

**Rate config page** at `/expenses/rate-config` with link from main "费率时段配置" in header.

Let me also add a link in sidebar - optional, can be only in-page.

Implement backend DTOs with class-validator - IsString, IsOptional, IsBoolean, IsNumber, IsUUID, Min, IsDateString

**Decimal** in DTOs - use string or number, transform in service to Prisma Decimal

**CurrentUser** payload shape




正在实现：先更新 Prisma 与迁移，再实现后端服务与前端功能。



Prisma 在沙箱中因文件锁未完全生成；代码已按新 schema 编写。正在创建后端服务与 DTO。



正在实现前端：编写 `api.ts` 与组件。



为支持 Harvest 式“查看全部队友费用”，正在扩展后端的列表查询参数。



## 已完成的实现概览

### 1. 数据库（Prisma + 迁移）

- `Expense` 增加：`isBillable`、`isReimbursable`、`unitQuantity`（与 Harvest 的 *billable / reimbursable / 按单位* 概念一致）。
- 新表 `ExpenseCategoryRate`：在组织内、按**费用类别**维护 **validFrom / validTo** 的**每单位单价**（如里程费按年或政策改价）。
- 迁移文件：`backend/prisma/migrations/20260423120000_expense_billable_and_category_rates/migration.sql`

**本地请执行**（在 `backend` 目录且数据库已可连时）：

```bash
npx prisma migrate deploy
npx prisma generate
```

（若本机有文件锁，可多试一次 `generate`。）

### 2. 后端（Nest，前缀 `/api`）

- `GET/POST /expenses`、`PATCH/DELETE /expenses/:id`
- `GET /expenses/form-options`：项目/类别下拉、默认货币
- `GET /expenses?userId&includeAllMembers&from&to`：`includeAllMembers=true` 时看**全组织**费用
- `GET/POST /expense-categories`、`PATCH/DELETE /expense-categories/:id`

模块已接入 `OrganizationContextService` 与 `PrismaService`。

### 3. 前端 `src/features/expenses/`

| 文件 | 作用 |
|------|------|
| `api.ts` | 各接口与 Request/Response 类型 |
| `lib/group-expenses-by-week.ts` | 按**自然周**分组、周状态/行状态展示 |
| `components/expense-list.tsx` | 周分组列表、可计费/可报销标签、小计、删除（仅自己的） |
| `components/expense-track-form.tsx` | 记费用（含单位价类别自动算金额） |
| `components/category-manager.tsx` | 类别增删改、归档、单位价 |
| `components/expense-rate-form.tsx` | 新增**时段 + 单价**（含时间范围与「无结束日」） |
| `pages/expenses-page.tsx` | 主站：队友筛选、全部/自己/或指定成员、Tab「全部费用 / 类别」、链到费率页 |
| `pages/expense-rate-config-page.tsx` | 费率配置与列表/编辑/删除 |
| `router.tsx` | 子路由 `expenses/rate-config` |

设计说明上已对齐你给的 **Harvest 截图**：可计费/可报销、周汇总、经理视角队友筛选、类别。
