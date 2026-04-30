import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchExpenseFormOptions, listExpenses } from './api'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/http', () => ({
  apiRequest,
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

describe('expenses api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('fetchExpenseFormOptions: GET /expenses/form-options', async () => {
    apiRequest.mockResolvedValue({
      projects: [],
      categories: [],
      defaultCurrency: 'USD',
    })
    await fetchExpenseFormOptions()
    expect(apiRequest).toHaveBeenCalledWith('/expenses/form-options', {
      method: 'GET',
    })
  })

  it('listExpenses: 带筛选参数', async () => {
    apiRequest.mockResolvedValue({ items: [] })
    await listExpenses({ from: '2026-01-01', to: '2026-01-31', includeAllMembers: true })
    const path = String(vi.mocked(apiRequest).mock.calls[0]![0])
    expect(path.startsWith('/expenses?')).toBe(true)
    expect(path).toContain('includeAllMembers=true')
    expect(path).toContain('from=2026-01-01')
    expect(path).toContain('to=2026-01-31')
    expect(apiRequest).toHaveBeenCalledWith(path, { method: 'GET' })
  })
})
