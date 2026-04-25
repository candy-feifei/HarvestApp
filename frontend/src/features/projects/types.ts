import type { TaskListItem } from '@/features/tasks/api'
import type { TeamMemberRow } from '@/features/team/api'

/** 与 Prisma / API 的 BillingMethod 对齐 */
export type ApiBillingMethod = 'TM' | 'FIXED_FEE' | 'NON_BILLABLE'

export type ApiBudgetType =
  | 'TOTAL_PROJECT_HOURS'
  | 'TOTAL_PROJECT_FEES'
  | 'HOURS_PER_PERSON'
  | 'NO_BUDGET'

/** 表单/ UI 用项目类型 */
export type ProjectTypeUi = 'time_materials' | 'fixed_fee' | 'non_billable'

/**
 * Billable rates 下拉（与截图一致）
 * - 仅当 projectType 为 time_materials 时有效
 */
export type BillableRateModeUi =
  | 'no_rate'
  | 'project_rate'
  | 'person_rate'
  | 'task_rate'

export type ProjectReportPermissionUi = 'admin' | 'everyone'

export type InvoiceDueModeUi =
  | 'upon_receipt'
  | 'net_15'
  | 'net_30'
  | 'net_45'
  | 'net_60'

/** 与组织任务库 `Task` 表关联；来自 common / 从 other 挑选加入 */
export type ProjectFormTask = {
  taskId: string
  name: string
  isBillable: boolean
  /** Task billable rate 模式下列内编辑 */
  hourlyRate: number
}

export type ProjectFormTeamMember = {
  userId: string
  name: string
  billableRate: number
  isManager: boolean
}

/**
 * 存入 metadata 的对象（与后端 `projects.metadata` JSON 对齐）
 */
export type ProjectMetadata = {
  billableRateMode?: BillableRateModeUi
  reportPermission?: ProjectReportPermissionUi
  /** 列表展示：已花费/成本（后端也可用于扩展） */
  spentAmount?: number
  costsAmount?: number
  /** 主负责人 userId，用于「按经理筛选」 */
  primaryManagerUserId?: string | null
  /** @deprecated Legacy only; use API `tasks` on ProjectRecord */
  tasks?: ProjectFormTask[]
  /** @deprecated Legacy only; use API `team` on ProjectRecord */
  team?: ProjectFormTeamMember[]
  invoice?: {
    dueMode: InvoiceDueModeUi
    poNumber: string
    taxPercent: number
    secondTaxEnabled: boolean
    secondTaxPercent: number
    discountPercent: number
  }
}

/** API 单条项目（getProject / 列表行） */
export type ProjectRecord = {
  id: string
  name: string
  code: string | null
  isBillable: boolean
  billingMethod: ApiBillingMethod
  hourlyRate: number | null
  fixedFee: number | null
  budgetType: ApiBudgetType
  budgetAmount: number | null
  notifyAt: number | null
  isArchived: boolean
  isPinned: boolean
  startsOn: string | null
  endsOn: string | null
  notes: string | null
  metadata: ProjectMetadata | null
  clientId: string
  clientName: string
  organizationId: string
  spentAmount: number
  costsAmount: number
  /** From `project_tasks`；无关系数据时见 metadata 回退。 */
  tasks?: ProjectApiTaskRow[]
  /** From `project_assignments`。 */
  team?: ProjectApiTeamRow[]
}

export type ProjectApiTaskRow = {
  taskId: string
  name: string
  isBillable: boolean
  hourlyRate: number
}

export type ProjectApiTeamRow = {
  userId: string
  name: string
  isManager: boolean
  billableRate: number
}

export type ProjectsPaginatedResponse = {
  data: ProjectRecord[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/** 列表行计算字段 */
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

export type ProjectTypeLabel = 'Time & Materials' | 'Fixed Fee' | 'Non-Billable'

export function projectTypeLabelFromApi(m: ApiBillingMethod): ProjectTypeLabel {
  switch (m) {
    case 'TM':
      return 'Time & Materials'
    case 'FIXED_FEE':
      return 'Fixed Fee'
    case 'NON_BILLABLE':
    default:
      return 'Non-Billable'
  }
}

export function apiBillingMethodToUi(m: ApiBillingMethod): ProjectTypeUi {
  switch (m) {
    case 'TM':
      return 'time_materials'
    case 'FIXED_FEE':
      return 'fixed_fee'
    case 'NON_BILLABLE':
    default:
      return 'non_billable'
  }
}

export function defaultProjectFormValues(): ProjectFormValues {
  return {
    clientId: '',
    name: '',
    projectCode: '',
    startDate: '',
    endDate: '',
    notes: '',
    reportPermission: 'admin',
    projectType: 'time_materials',
    billableRateMode: 'project_rate',
    projectHourlyRate: 0,
    projectFees: 0,
    budgetType: 'NO_BUDGET',
    budgetAmount: null,
    spentAmount: 0,
    costsAmount: 0,
    primaryManagerUserId: null,
    /** 由任务库 common 在页面加载后填充 */
    tasks: [],
    team: [],
    invoice: {
      dueMode: 'upon_receipt',
      poNumber: '',
      taxPercent: 0,
      secondTaxEnabled: false,
      secondTaxPercent: 0,
      discountPercent: 0,
    },
  }
}

/**
 * 新建/编辑页使用的完整表单值（与 API 通过 map 函数互转）
 */
export type ProjectFormValues = {
  clientId: string
  name: string
  projectCode: string
  startDate: string
  endDate: string
  notes: string
  reportPermission: ProjectReportPermissionUi
  projectType: ProjectTypeUi
  billableRateMode: BillableRateModeUi
  /** Project billable rate 时项目级时薪 */
  projectHourlyRate: number
  /** Fixed fee 类型时项目总费用 */
  projectFees: number
  budgetType: ApiBudgetType
  budgetAmount: number | null
  /** 与列表一致：metadata 内，用于假数据/手工维护 */
  spentAmount: number
  costsAmount: number
  primaryManagerUserId: string | null
  tasks: ProjectFormTask[]
  team: ProjectFormTeamMember[]
  invoice: NonNullable<ProjectMetadata['invoice']>
}

type TaskRowSaved = ProjectFormTask & { id?: string }

function normalizeProjectFormTask(t: TaskRowSaved): ProjectFormTask {
  const taskId = t.taskId || t.id || ''
  return {
    taskId,
    name: t.name,
    isBillable: t.isBillable,
    hourlyRate: t.hourlyRate,
  }
}

export function parseTaskDefaultRate(amount: string | null): number {
  if (amount == null || amount === '') return 0
  const n = Number(amount)
  return Number.isFinite(n) ? n : 0
}

/** 新建项目：用任务库中的 Common tasks 预填行 */
export function projectTasksFromCommonItems(common: TaskListItem[]): ProjectFormTask[] {
  return common.map((t) => ({
    taskId: t.id,
    name: t.name,
    isBillable: t.isBillable,
    hourlyRate: parseTaskDefaultRate(t.defaultHourlyRate),
  }))
}

/**
 * 编辑项目：只展示已保存任务行（API `tasks` 或旧 metadata）；名称若任务库中仍存在则与库同步
 */
export function projectTasksForEditFromSaved(
  saved: ProjectFormTask[] | undefined,
  common: TaskListItem[],
  other: TaskListItem[],
): ProjectFormTask[] {
  const savedList = (saved ?? []).map((x) =>
    normalizeProjectFormTask(x as TaskRowSaved),
  )
  const byId = new Map<string, TaskListItem>()
  for (const t of common) byId.set(t.id, t)
  for (const t of other) byId.set(t.id, t)
  return savedList.map((s) => {
    const c = byId.get(s.taskId)
    if (!c) {
      return s
    }
    return {
      taskId: s.taskId,
      name: c.name,
      isBillable: s.isBillable,
      hourlyRate: s.hourlyRate,
    }
  })
}

export function teamMemberLabel(row: TeamMemberRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || row.email
}

export function teamRowToFormMember(
  row: TeamMemberRow,
  overrides?: Partial<Pick<ProjectFormTeamMember, 'isManager' | 'billableRate'>>,
): ProjectFormTeamMember {
  return {
    userId: row.userId,
    name: teamMemberLabel(row),
    billableRate:
      overrides?.billableRate ?? row.defaultBillableRatePerHour ?? 0,
    isManager: overrides?.isManager ?? false,
  }
}

/** 新建项目：默认将当前登录成员（匹配 memberId）加入团队并设为经理 */
export function projectTeamInitialForNewUser(
  ctx: { memberId: string } | undefined,
  teamRows: TeamMemberRow[],
): ProjectFormTeamMember[] {
  if (!ctx) return []
  const row = teamRows.find((m) => m.memberId === ctx.memberId)
  if (!row) return []
  return [teamRowToFormMember(row, { isManager: true })]
}

/** 编辑：仅已保存成员；若仍在组织中则名称与库同步 */
export function projectTeamForEditFromSaved(
  saved: ProjectFormTeamMember[] | undefined,
  teamRows: TeamMemberRow[],
): ProjectFormTeamMember[] {
  const list = saved ?? []
  const byUserId = new Map(teamRows.map((t) => [t.userId, t] as const))
  return list.map((s) => {
    const r = byUserId.get(s.userId)
    if (!r) {
      return s
    }
    return {
      userId: s.userId,
      name: teamMemberLabel(r),
      billableRate: s.billableRate,
      isManager: s.isManager,
    }
  })
}

export function projectFormValuesFromRecord(p: ProjectRecord): ProjectFormValues {
  const meta = p.metadata ?? {}
  const fromApiTasks = p.tasks?.length
    ? p.tasks.map((t) => ({
        taskId: t.taskId,
        name: t.name,
        isBillable: t.isBillable,
        hourlyRate: t.hourlyRate ?? 0,
      }))
    : null
  const fromMetaTasks = meta.tasks
  const rawTasks = fromApiTasks?.length
    ? fromApiTasks
    : fromMetaTasks?.length
      ? (fromMetaTasks as TaskRowSaved[]).map((t) => normalizeProjectFormTask(t))
      : []
  const fromApiTeam = p.team?.length ? p.team : null
  const fromMetaTeam = meta.team
  return {
    clientId: p.clientId,
    name: p.name,
    projectCode: p.code ?? '',
    startDate: p.startsOn ? p.startsOn.slice(0, 10) : '',
    endDate: p.endsOn ? p.endsOn.slice(0, 10) : '',
    notes: p.notes ?? '',
    reportPermission: meta.reportPermission ?? 'admin',
    projectType: apiBillingMethodToUi(p.billingMethod),
    billableRateMode: meta.billableRateMode ?? 'project_rate',
    projectHourlyRate: p.hourlyRate ?? 0,
    projectFees: p.fixedFee ?? 0,
    budgetType: p.budgetType,
    budgetAmount: p.budgetAmount,
    spentAmount: p.spentAmount,
    costsAmount: p.costsAmount,
    primaryManagerUserId: meta.primaryManagerUserId ?? null,
    tasks: rawTasks,
    team:
      fromApiTeam && fromApiTeam.length > 0
        ? fromApiTeam
        : fromMetaTeam?.length
          ? fromMetaTeam
          : [],
    invoice: {
      dueMode: meta.invoice?.dueMode ?? 'upon_receipt',
      poNumber: meta.invoice?.poNumber ?? '',
      taxPercent: meta.invoice?.taxPercent ?? 0,
      secondTaxEnabled: meta.invoice?.secondTaxEnabled ?? false,
      secondTaxPercent: meta.invoice?.secondTaxPercent ?? 0,
      discountPercent: meta.invoice?.discountPercent ?? 0,
    },
  }
}
