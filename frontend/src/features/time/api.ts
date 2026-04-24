import { apiRequest } from '@/lib/api/http'

export const timeEntriesResourcePath = '/time-entries'

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
  items: TimeEntryListItem[]
}

export function listAssignableTimeRows() {
  return apiRequest<{ rows: AssignableRow[] }>(`${timeEntriesResourcePath}/assignable-rows`, {
    method: 'GET',
  })
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

export function approveTimeEntry(id: string) {
  return apiRequest<{ item: TimeEntryListItem }>(`${timeEntriesResourcePath}/${id}/approve`, {
    method: 'POST',
  })
}
