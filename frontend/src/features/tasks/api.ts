import { getAccessToken } from '@/lib/auth/access-token'
import { ApiError, apiRequest } from '@/lib/api/http'
import { getPublicApiBaseUrl } from '@/lib/api/public-env'

function joinUrl(base: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base.replace(/\/$/, '')}${normalizedPath}`
}

export type TaskListItem = {
  id: string
  name: string
  isCommon: boolean
  isBillable: boolean
  defaultHourlyRate: string | null
}

export type TasksListResponse = {
  common: TaskListItem[]
  other: TaskListItem[]
}

export function listTasks(q?: string) {
  const path =
    q != null && q.trim() !== ''
      ? `/tasks?${new URLSearchParams({ q: q.trim() })}`
      : '/tasks'
  return apiRequest<TasksListResponse>(path, { method: 'GET' })
}

export function fetchTask(id: string) {
  return apiRequest<TaskListItem>(`/tasks/${id}`, { method: 'GET' })
}

export type CreateTaskPayload = {
  name: string
  isCommon: boolean
  isBillable: boolean
  defaultHourlyRate?: number
  addToAllExistingProjects?: boolean
}

export function createTask(body: CreateTaskPayload) {
  return apiRequest<TaskListItem>('/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type UpdateTaskPayload = {
  name?: string
  isCommon?: boolean
  isBillable?: boolean
  defaultHourlyRate?: number | null
  addToAllExistingProjects?: boolean
}

export function updateTask(id: string, body: UpdateTaskPayload) {
  return apiRequest<TaskListItem>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function archiveTask(id: string) {
  return apiRequest<{ id: string; archived: true }>(`/tasks/${id}/archive`, {
    method: 'POST',
  })
}

export function batchArchiveTasks(ids: string[]) {
  return apiRequest<{ updated: number }>('/tasks/batch/archive', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function deleteTask(id: string) {
  return apiRequest<{ id: string; deleted: true }>(`/tasks/${id}`, {
    method: 'DELETE',
  })
}

export async function downloadTasksExport(q: string, format: 'csv' | 'json') {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  params.set('format', format)
  const path = `/tasks/export?${params.toString()}`
  const url = joinUrl(getPublicApiBaseUrl(), path)
  const headers = new Headers()
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text()
    let data: unknown = text
    try {
      data = text.length > 0 ? (JSON.parse(text) as unknown) : null
    } catch {
      data = text
    }
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText
    if (res.status === 401) {
      const { clearAccessToken, notifyAuthExpired } = await import(
        '@/lib/auth/access-token'
      )
      clearAccessToken()
      notifyAuthExpired()
    }
    throw new ApiError(message || 'Export failed', res.status, data)
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = format === 'json' ? 'tasks.json' : 'tasks.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
