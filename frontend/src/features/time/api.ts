import { apiRequest } from '@/lib/api/http'

export const timeEntriesResourcePath = '/time-entries'

export type TimeEntryTimer = {
  id: string
  projectTaskId: string
  /** YYYY-MM-DD */
  date: string
  spentDate: string
  startedAt: string
  notes: string | null
  clientName: string
  projectName: string
  taskName: string
}

export type AssignableRow = {
  projectTaskId: string
  projectId: string
  taskId: string
  clientId: string
  clientName: string
  projectName: string
  taskName: string
}

export type TimeEntryListItem = {
  id: string
  userId: string
  projectId: string
  projectTaskId: string
  clientId: string
  clientName: string
  projectName: string
  taskName: string
  date: string
  spentDate: string
  hours: number
  notes: string | null
  status: 'UNSUBMITTED' | 'SUBMITTED' | 'APPROVED'
  isLocked: boolean
  createdAt: string
  updatedAt: string
}

export type TimeEntryListResult = {
  mode: 'week' | 'month'
  range: { from: string; toExclusive: string }
  forUser: string
  /** 与 range 所对应 ISO 周在 approvals 表中的填报窗口（同 submit 查询逻辑）；有且 status 为 APPROVED 时整周只读。month 视图为 null。 */
  weekApproval: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
    periodStart: string
    periodEnd: string
  } | null
  items: TimeEntryListItem[]
}

export function listAssignableTimeRows() {
  return apiRequest<{ rows: AssignableRow[] }>(`${timeEntriesResourcePath}/assignable-rows`, {
    method: 'GET',
  })
}

export type TrackTimeTaskOption = {
  projectTaskId: string
  taskId: string
  taskName: string
}

/** 与 assignable-rows 分组后的结构相同（由 Project+Client+ProjectTask 在服务端展平，此处按 project 聚合） */
export type TrackTimeProjectOption = {
  projectId: string
  name: string
  clientId: string
  clientName: string
  tasks: TrackTimeTaskOption[]
}

/** 备用：无 track-time-options 时可用 assignable 行本地聚合。 */
export function groupAssignableRowsToTrackProjects(rows: AssignableRow[]): TrackTimeProjectOption[] {
  const byProject = new Map<
    string,
    { projectId: string; name: string; clientId: string; clientName: string; tasks: TrackTimeTaskOption[] }
  >()
  for (const r of rows) {
    if (!byProject.has(r.projectId)) {
      byProject.set(r.projectId, {
        projectId: r.projectId,
        name: r.projectName,
        clientId: r.clientId,
        clientName: r.clientName,
        tasks: [],
      })
    }
    const p = byProject.get(r.projectId)!
    if (!p.tasks.some((t) => t.projectTaskId === r.projectTaskId)) {
      p.tasks.push({
        projectTaskId: r.projectTaskId,
        taskId: r.taskId,
        taskName: r.taskName,
      })
    }
  }
  const out: TrackTimeProjectOption[] = [...byProject.values()].map((p) => ({
    projectId: p.projectId,
    name: p.name,
    clientId: p.clientId,
    clientName: p.clientName,
    tasks: [...p.tasks].sort((a, b) => a.taskName.localeCompare(b.taskName, 'en')),
  }))
  out.sort(
    (a, b) => a.clientName.localeCompare(b.clientName, 'en') || a.name.localeCompare(b.name, 'en'),
  )
  return out
}

/** `GET /time-entries/track-time-options`：服务端从 projects 联表 client 与 project_tasks。 */
export function listTrackTimeOptions() {
  return apiRequest<{ projects: TrackTimeProjectOption[] }>(
    `${timeEntriesResourcePath}/track-time-options`,
    { method: 'GET' },
  )
}

export function listTimeEntries(q?: { week?: string; month?: string; forUser?: string }) {
  const sp = new URLSearchParams()
  if (q?.week) sp.set('week', q.week)
  if (q?.month) sp.set('month', q.month)
  if (q?.forUser) sp.set('forUser', q.forUser)
  const qs = sp.toString()
  return apiRequest<TimeEntryListResult>(`${timeEntriesResourcePath}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  })
}

export type CreateTimeEntryPayload = {
  projectTaskId: string
  date: string
  hours: number
  notes?: string
}

export function createTimeEntry(body: CreateTimeEntryPayload) {
  return apiRequest<
    | { action: 'saved'; item: TimeEntryListItem }
    | { action: 'deleted' | 'noop'; removed?: boolean; id?: string }
  >(timeEntriesResourcePath, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateTimeEntry(
  id: string,
  body: { hours?: number; notes?: string },
) {
  return apiRequest<
    { action: 'saved'; item: TimeEntryListItem } | { action: 'deleted'; id: string }
  >(`${timeEntriesResourcePath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteTimeEntry(id: string) {
  return apiRequest<void>(`${timeEntriesResourcePath}/${id}`, {
    method: 'DELETE',
  })
}

export function submitTimeWeek(weekOf: string) {
  return apiRequest<{
    lockedCount: number
    weekFrom: string
    toExclusive: string
  }>(`${timeEntriesResourcePath}/submit-week`, {
    method: 'POST',
    body: JSON.stringify({ weekOf }),
  })
}

export function withdrawTimeWeek(weekOf: string) {
  return apiRequest<{
    unlockedCount: number
    weekFrom: string
    toExclusive: string
  }>(`${timeEntriesResourcePath}/withdraw-week`, {
    method: 'POST',
    body: JSON.stringify({ weekOf }),
  })
}

export function copyFromRecentDay(date: string) {
  return apiRequest<{
    copied: number
    skipped: number
    sourceDate: string | null
    targetDate: string
    message?: string
  }>(`${timeEntriesResourcePath}/copy-from-recent-day`, {
    method: 'POST',
    body: JSON.stringify({ date }),
  })
}

export function copyFromRecentWeek(weekOf: string) {
  return apiRequest<{
    copied: number
    skipped: number
    sourceWeekFrom: string
    targetWeekFrom: string
    message?: string
  }>(`${timeEntriesResourcePath}/copy-from-recent-week`, {
    method: 'POST',
    body: JSON.stringify({ weekOf }),
  })
}

export function approveTimeEntry(id: string) {
  return apiRequest<{ item: TimeEntryListItem }>(`${timeEntriesResourcePath}/${id}/approve`, {
    method: 'POST',
  })
}

export function getActiveTimeEntryTimer() {
  return apiRequest<{ timer: TimeEntryTimer | null }>(`${timeEntriesResourcePath}/timer/active`, {
    method: 'GET',
  })
}

export function startTimeEntryTimer(body: { projectTaskId: string; date: string; notes?: string }) {
  return apiRequest<{ timer: TimeEntryTimer }>(`${timeEntriesResourcePath}/timer/start`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function stopTimeEntryTimer(id: string) {
  return apiRequest<{ action: 'stopped'; item: TimeEntryListItem | null }>(
    `${timeEntriesResourcePath}/timer/${id}/stop`,
    { method: 'POST' },
  )
}
