import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchReportFilters, fetchTimeReport, reportsBasePath } from './api'

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

describe('reports api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('reportsBasePath', () => {
    expect(reportsBasePath).toBe('/reports')
  })

  it('fetchReportFilters: 带 X-Organization-Id', async () => {
    apiRequest.mockResolvedValue({
      currency: 'USD',
      clients: [],
      team: [],
      projects: [],
      tasks: [],
      projectManagers: [],
    })
    await fetchReportFilters('org-xyz')
    expect(apiRequest).toHaveBeenCalledWith(`${reportsBasePath}/filters`, {
      method: 'GET',
      headers: { 'X-Organization-Id': 'org-xyz' },
    })
  })

  it('fetchTimeReport: 路径含查询参数与组织头', async () => {
    apiRequest.mockResolvedValue({
      range: { fromYmd: '2026-01-01', toYmd: '2026-01-31', currency: 'USD' },
      groupBy: 'projects',
      summary: {} as never,
      rows: [],
      totals: { hours: 0, billableHours: 0, billableAmount: 0 },
    })
    await fetchTimeReport('org-1', {
      fromYmd: '2026-01-01',
      toYmd: '2026-01-31',
      groupBy: 'projects',
      activeProjectsOnly: true,
    })
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringMatching(/^\/reports\/time\?/),
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-Organization-Id': 'org-1' },
      }),
    )
    const url = String(vi.mocked(apiRequest).mock.calls[0]![0])
    expect(url).toContain('fromYmd=2026-01-01')
    expect(url).toContain('toYmd=2026-01-31')
    expect(url).toContain('groupBy=projects')
    expect(url).toContain('activeProjectsOnly=true')
  })
})
