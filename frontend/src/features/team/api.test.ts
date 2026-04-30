import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listTeamMembers } from './api'

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

describe('team api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('listTeamMembers: GET /organizations/members', async () => {
    apiRequest.mockResolvedValue({ items: [] })
    await listTeamMembers()
    expect(apiRequest).toHaveBeenCalledWith('/organizations/members', {
      method: 'GET',
    })
  })
})
