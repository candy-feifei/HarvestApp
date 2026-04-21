import {
  clearAccessToken,
  getAccessToken,
  notifyAuthExpired,
} from '@/lib/auth/access-token'
import { getPublicApiBaseUrl } from '@/lib/api/public-env'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function joinUrl(base: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base.replace(/\/$/, '')}${normalizedPath}`
}

/**
 * 统一对接 NestJS（或网关）的 fetch 封装：JSON、错误归一、便于在页面与 Query 中复用。
 * 方案 B：从 sessionStorage 读取 access_token，自动附加 `Authorization: Bearer`；401 时清 token 并派发 `harvestapp:auth-expired`。
 */
export async function apiRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = joinUrl(getPublicApiBaseUrl(), path)
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let data: unknown = text

  if (text.length > 0) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  } else {
    data = null
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAccessToken()
      notifyAuthExpired()
    }
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText
    throw new ApiError(message || 'Request failed', res.status, data)
  }

  if (res.status === 204 || text.length === 0) {
    return undefined as T
  }

  return data as T
}
