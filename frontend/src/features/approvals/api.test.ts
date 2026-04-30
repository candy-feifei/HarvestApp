import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchApprovalsMeta } from './api'

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

describe('approvals api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('fetchApprovalsMeta: GET /approvals/meta', async () => {
    apiRequest.mockResolvedValue({
      reportPeriods: [],
      groupBy: [],
      entryStatus: [],
    })
    await fetchApprovalsMeta(undefined)
    expect(apiRequest).toHaveBeenCalledWith('/approvals/meta', {
      method: 'GET',
      headers: {},
    })
  })

  it('fetchApprovalsMeta: 传入组织时带头', async () => {
    apiRequest.mockResolvedValue({
      reportPeriods: [],
      groupBy: [],
      entryStatus: [],
    })
    await fetchApprovalsMeta('org-1')
    expect(apiRequest).toHaveBeenCalledWith('/approvals/meta', {
      method: 'GET',
      headers: { 'X-Organization-Id': 'org-1' },
    })
  })
})
