/**
 * Tasks 前端单测约定（Vitest）：
 * - 位置：与 `api.ts` 同目录，`*.test.ts` / 页面用 `*.test.tsx`；`vite.config` 的 `test.include` 会拾取它们。
 * - Mock：对纯网络层用 `vi.mock('@/lib/api/http')` 拦截 `apiRequest`，不发出真实 fetch；页面 / Query 可再对 `@/features/tasks/api` 做
 *   `vi.mock(..., importOriginal)` 只替换 `listTasks` 等，保留其余真实导出；需要全链路时再用 MSW。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listTasks } from './api'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/http', () => ({
  apiRequest: apiRequest,
  ApiError: class ApiError extends Error {
    status = 0
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  },
}))

describe('tasks api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('listTasks: 无 q 时请求 /tasks', async () => {
    apiRequest.mockResolvedValue({ common: [], other: [] })
    await listTasks()
    expect(apiRequest).toHaveBeenCalledWith('/tasks', { method: 'GET' })
  })

  it('listTasks: 有 q 时带查询参数', async () => {
    apiRequest.mockResolvedValue({ common: [], other: [] })
    await listTasks('  hello  ')
    expect(apiRequest).toHaveBeenCalledWith('/tasks?q=hello', { method: 'GET' })
  })
})
