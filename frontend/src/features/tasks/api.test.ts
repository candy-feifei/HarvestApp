/**
 * Tasks 前端单测约定（Vitest）：
 * - 位置：与 `api.ts` 同目录，`*.test.ts` / 页面用 `*.test.tsx`；`vite.config` 的 `test.include` 会拾取它们。
 * - Mock：对纯网络层用 `vi.mock('@/lib/api/http')` 拦截 `apiRequest`，不发出真实 fetch；页面 / Query 可再对 `@/features/tasks/api` 做
 *   `vi.mock(..., importOriginal)` 只替换 `listTasks` 等，保留其余真实导出；需要全链路时再用 MSW。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveTask,
  batchArchiveTasks,
  createTask,
  deleteTask,
  fetchTask,
  listTasks,
  updateTask,
} from './api'

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

  it('fetchTask: GET /tasks/:id', async () => {
    apiRequest.mockResolvedValue({
      id: 't1',
      name: 'T',
      isCommon: false,
      isBillable: true,
      defaultHourlyRate: null,
    })
    await fetchTask('t1')
    expect(apiRequest).toHaveBeenCalledWith('/tasks/t1', { method: 'GET' })
  })

  it('createTask: POST /tasks', async () => {
    apiRequest.mockResolvedValue({
      id: 't1',
      name: 'N',
      isCommon: false,
      isBillable: true,
      defaultHourlyRate: null,
    })
    await createTask({
      name: 'N',
      isCommon: false,
      isBillable: true,
      addToAllExistingProjects: true,
    })
    expect(apiRequest).toHaveBeenCalledWith('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        name: 'N',
        isCommon: false,
        isBillable: true,
        addToAllExistingProjects: true,
      }),
    })
  })

  it('updateTask: PATCH /tasks/:id', async () => {
    apiRequest.mockResolvedValue({
      id: 't1',
      name: 'N2',
      isCommon: true,
      isBillable: false,
      defaultHourlyRate: '10',
    })
    await updateTask('t1', { name: 'N2', isCommon: true })
    expect(apiRequest).toHaveBeenCalledWith('/tasks/t1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'N2', isCommon: true }),
    })
  })

  it('archiveTask: POST /tasks/:id/archive', async () => {
    apiRequest.mockResolvedValue({ id: 't1', archived: true })
    await archiveTask('t1')
    expect(apiRequest).toHaveBeenCalledWith('/tasks/t1/archive', {
      method: 'POST',
    })
  })

  it('batchArchiveTasks: POST /tasks/batch/archive', async () => {
    apiRequest.mockResolvedValue({ updated: 2 })
    await batchArchiveTasks(['a', 'b'])
    expect(apiRequest).toHaveBeenCalledWith('/tasks/batch/archive', {
      method: 'POST',
      body: JSON.stringify({ ids: ['a', 'b'] }),
    })
  })

  it('deleteTask: DELETE /tasks/:id', async () => {
    apiRequest.mockResolvedValue({ id: 't1', deleted: true })
    await deleteTask('t1')
    expect(apiRequest).toHaveBeenCalledWith('/tasks/t1', { method: 'DELETE' })
  })
})
