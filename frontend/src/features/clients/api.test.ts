import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listClients, fetchClient } from './api'

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

describe('clients api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('listClients: 无 q 时 GET /clients', async () => {
    apiRequest.mockResolvedValue({ items: [] })
    await listClients()
    expect(apiRequest).toHaveBeenCalledWith('/clients', { method: 'GET' })
  })

  it('listClients: 有 q 时带查询参数', async () => {
    apiRequest.mockResolvedValue({ items: [] })
    await listClients('  acme  ')
    expect(apiRequest).toHaveBeenCalledWith('/clients?q=acme', { method: 'GET' })
  })

  it('fetchClient: GET /clients/:id', async () => {
    apiRequest.mockResolvedValue({ id: 'c1' })
    await fetchClient('c1')
    expect(apiRequest).toHaveBeenCalledWith('/clients/c1', { method: 'GET' })
  })
})
