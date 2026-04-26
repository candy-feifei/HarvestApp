import { apiRequest } from '@/lib/api/http'

export const reportsBasePath = '/reports'

function orgHeaders(organizationId?: string): HeadersInit {
  if (!organizationId) {
    return {}
  }
  return { 'X-Organization-Id': organizationId }
}

export type TimeReportGroup = 'clients' | 'projects' | 'tasks' | 'team'

export type TimeReport = {
  range: { fromYmd: string; toYmd: string; currency: string }
  groupBy: TimeReportGroup
  summary: {
    totalHours: number
    billableHours: number
    nonBillableHours: number
    billableOfTotalPct: number
    billableAmount: number
    uninvoicedAmount: number
    invoicedAmount: number
    hasMissingRate: boolean
  }
  rows: Array<{
    id: string
    name: string
    clientName: string | null
    hours: number
    hourShare: number
    billableHours: number
    billableHoursOfTotalPct: number
    billableAmount: number
    utilizationPercent: number | null
  }>
  totals: { hours: number; billableHours: number; billableAmount: number }
}

export type TimeReportQuery = {
  fromYmd: string
  toYmd: string
  groupBy: TimeReportGroup
  activeProjectsOnly: boolean
  clientIds?: string[]
  projectIds?: string[]
  userIds?: string[]
  taskIds?: string[]
}

function appendCsvParam(
  p: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value != null && value.length) {
    p.set(key, value)
  }
}

function timeQueryToString(q: TimeReportQuery): string {
  const p = new URLSearchParams()
  p.set('fromYmd', q.fromYmd)
  p.set('toYmd', q.toYmd)
  p.set('groupBy', q.groupBy)
  p.set('activeProjectsOnly', String(q.activeProjectsOnly))
  if (q.clientIds?.length) p.set('clientIds', q.clientIds.join(','))
  if (q.projectIds?.length) p.set('projectIds', q.projectIds.join(','))
  if (q.userIds?.length) p.set('userIds', q.userIds.join(','))
  if (q.taskIds?.length) p.set('taskIds', q.taskIds.join(','))
  return p.toString()
}

export function fetchTimeReport(
  organizationId: string | undefined,
  q: TimeReportQuery,
) {
  return apiRequest<TimeReport>(
    `${reportsBasePath}/time?${timeQueryToString(q)}`,
    { method: 'GET', headers: orgHeaders(organizationId) },
  )
}

export type ProfitabilitySeries = {
  month: string
  label: string
  revenue: number
  costs: number
  profit: number
}

export type ProfitabilityReport = {
  range: { fromYmd: string; toYmd: string; currency: string }
  hasMissingRate: boolean
  series: ProfitabilitySeries[]
  summary: {
    revenue: { total: number; invoiced: number; uninvoiced: number }
    costs: { total: number; fromTime: number; fromExpenses: number }
    profit: { amount: number; marginPercent: number }
  }
  groupBy: TimeReportGroup
  rows: Array<{
    id: string
    name: string
    clientName: string | null
    subLabel: string | null
    revenue: number
    cost: number
    profit: number
    returnOnCostPercent: number | null
    hasMissingRate: boolean
    profitBarShare: number
    marginPercent: number
  }>
  totals: { revenue: number; cost: number; profit: number }
}

export type ProfitabilityQuery = {
  fromYmd: string
  toYmd: string
  groupBy: TimeReportGroup
  currency?: string
  projectStatuses?: string
  projectTypes?: string
  projectManagerUserIds?: string
}

function profitabilityToString(q: ProfitabilityQuery): string {
  const p = new URLSearchParams()
  p.set('fromYmd', q.fromYmd)
  p.set('toYmd', q.toYmd)
  p.set('groupBy', q.groupBy)
  appendCsvParam(p, 'currency', q.currency)
  appendCsvParam(p, 'projectStatuses', q.projectStatuses)
  appendCsvParam(p, 'projectTypes', q.projectTypes)
  appendCsvParam(p, 'projectManagerUserIds', q.projectManagerUserIds)
  return p.toString()
}

export function fetchProfitabilityReport(
  organizationId: string | undefined,
  q: ProfitabilityQuery,
) {
  return apiRequest<ProfitabilityReport>(
    `${reportsBasePath}/profitability?${profitabilityToString(q)}`,
    { method: 'GET', headers: orgHeaders(organizationId) },
  )
}

export type ReportFilters = {
  currency: string
  clients: { id: string; name: string }[]
  team: { userId: string; label: string; email: string }[]
  projects: Array<{
    id: string
    name: string
    clientId: string
    clientName: string
    billingMethod: string
    isArchived: boolean
    hasManager: boolean
  }>
  tasks: { id: string; name: string }[]
  projectManagers: { userId: string; label: string }[]
}

export function fetchReportFilters(organizationId: string | undefined) {
  return apiRequest<ReportFilters>(`${reportsBasePath}/filters`, {
    method: 'GET',
    headers: orgHeaders(organizationId),
  })
}
