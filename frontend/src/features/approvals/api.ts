import { apiRequest } from '@/lib/api/http'

export type ReportPeriod = 'DAY' | 'WEEK' | 'SEMIMONTH' | 'MONTH' | 'QUARTER' | 'CUSTOM'

export type ApprovalsGroupBy = 'PERSON' | 'PROJECT' | 'CLIENT'

export type ApprovalsEntryStatus = 'UNSUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'ALL'

export type ApprovalsMeta = {
  reportPeriods: ReportPeriod[]
  groupBy: ApprovalsGroupBy[]
  entryStatus: ApprovalsEntryStatus[]
}

export type ApprovalsFilters = {
  clients: { id: string; name: string }[]
  projects: { id: string; name: string; clientId: string; clientName: string }[]
  roles: { id: string; name: string }[]
  teammates: {
    userId: string
    memberId: string
    firstName: string
    lastName: string
    email: string
    label: string
  }[]
}

export type ApprovalsViewRow = {
  groupId: string
  lineLabel: string
  lineSub: string | null
  hours: number
  billableHours: number
  nonBillableHours: number
  billableExpense: number
  nonBillableExpense: number
  isFullyLockedApproved: boolean
  hasApprovableSubmitted: boolean
  canWithdraw: boolean
  timeEntryIds: string[]
  expenseIds: string[]
  rowUser: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  rowProject: { id: string; name: string } | null
  rowClient: { id: string; name: string } | null
}

export type ApprovalsView = {
  from: string
  to: string
  entryStatus: string
  groupBy: ApprovalsGroupBy
  summary: {
    totalHours: number
    billableHours: number
    nonBillableHours: number
    totalExpense: number
    billableExpense: number
    nonBillableExpense: number
  }
  rows: ApprovalsViewRow[]
}

export type ApprovalsViewQuery = {
  from: string
  to: string
  groupBy: ApprovalsGroupBy
  entryStatus?: ApprovalsEntryStatus
  clientIds?: string[]
  projectIds?: string[]
  roleIds?: string[]
  userIds?: string[]
}

function orgHeaders(organizationId?: string): HeadersInit {
  if (!organizationId) {
    return {}
  }
  return { 'X-Organization-Id': organizationId }
}

function queryToSearchParams(q: ApprovalsViewQuery): string {
  const p = new URLSearchParams()
  p.set('from', q.from)
  p.set('to', q.to)
  p.set('groupBy', q.groupBy)
  if (q.entryStatus) {
    p.set('entryStatus', q.entryStatus)
  }
  if (q.clientIds?.length) {
    p.set('clientIds', q.clientIds.join(','))
  }
  if (q.projectIds?.length) {
    p.set('projectIds', q.projectIds.join(','))
  }
  if (q.roleIds?.length) {
    p.set('roleIds', q.roleIds.join(','))
  }
  if (q.userIds?.length) {
    p.set('userIds', q.userIds.join(','))
  }
  return p.toString()
}

export function fetchApprovalsMeta(organizationId?: string) {
  return apiRequest<ApprovalsMeta>('/approvals/meta', {
    method: 'GET',
    headers: orgHeaders(organizationId),
  })
}

export function fetchApprovalsFilters(organizationId?: string) {
  return apiRequest<ApprovalsFilters>('/approvals/filters', {
    method: 'GET',
    headers: orgHeaders(organizationId),
  })
}

export function fetchApprovalsView(
  q: ApprovalsViewQuery,
  organizationId?: string,
) {
  const s = queryToSearchParams(q)
  return apiRequest<ApprovalsView>(`/approvals?${s}`, {
    method: 'GET',
    headers: orgHeaders(organizationId),
  })
}

export function buildViewQueryBody(q: ApprovalsViewQuery): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from: q.from,
    to: q.to,
    groupBy: q.groupBy,
  }
  if (q.entryStatus) {
    body.entryStatus = q.entryStatus
  }
  if (q.clientIds?.length) {
    body.clientIds = q.clientIds.join(',')
  }
  if (q.projectIds?.length) {
    body.projectIds = q.projectIds.join(',')
  }
  if (q.roleIds?.length) {
    body.roleIds = q.roleIds.join(',')
  }
  if (q.userIds?.length) {
    body.userIds = q.userIds.join(',')
  }
  return body
}

export function postApproveGroup(
  q: ApprovalsViewQuery,
  groupId: string,
  organizationId?: string,
) {
  return apiRequest<{ ok: true; updated: number }>('/approvals/approve', {
    method: 'POST',
    headers: { ...orgHeaders(organizationId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...buildViewQueryBody(q), groupId }),
  })
}

export function postApproveAllVisible(
  q: ApprovalsViewQuery,
  organizationId?: string,
) {
  return apiRequest<{ ok: true; groups: number; updated: number }>(
    '/approvals/approve-all',
    {
      method: 'POST',
      headers: { ...orgHeaders(organizationId), 'Content-Type': 'application/json' },
      body: JSON.stringify(buildViewQueryBody(q)),
    },
  )
}

export function postWithdrawGroup(
  q: ApprovalsViewQuery,
  groupId: string,
  organizationId?: string,
) {
  return apiRequest<{ ok: true; timeEntries: number; expenses: number }>(
    '/approvals/withdraw',
    {
      method: 'POST',
      headers: { ...orgHeaders(organizationId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildViewQueryBody(q), groupId }),
    },
  )
}

export function postNotifyGroup(
  q: ApprovalsViewQuery,
  groupId: string,
  organizationId?: string,
) {
  return apiRequest<{ ok: true; sent: boolean; message: string }>(
    '/approvals/notify',
    {
      method: 'POST',
      headers: { ...orgHeaders(organizationId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildViewQueryBody(q), groupId }),
    },
  )
}
