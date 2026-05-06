import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createClient,
  fetchClient,
  fetchOrganizationContext,
  listClients,
  updateClient,
} from './api'

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

  it('fetchOrganizationContext: GET /organizations/context', async () => {
    apiRequest.mockResolvedValue({
      organizationId: 'o1',
      memberId: 'm1',
      systemRole: 'MEMBER',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      organization: { id: 'o1', name: 'Org', defaultCurrency: 'USD' },
    })
    await fetchOrganizationContext()
    expect(apiRequest).toHaveBeenCalledWith('/organizations/context', {
      method: 'GET',
    })
  })

  it('createClient: POST /clients', async () => {
    apiRequest.mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      resolvedCurrency: 'USD',
    })
    const body = {
      name: 'Acme',
      currency: 'USD' as const,
      invoiceDueMode: 'UPON_RECEIPT' as const,
    }
    await createClient(body)
    expect(apiRequest).toHaveBeenCalledWith('/clients', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  })

  it('updateClient: PATCH /clients/:id', async () => {
    apiRequest.mockResolvedValue({
      id: 'c1',
      name: 'Acme2',
      resolvedCurrency: 'USD',
    })
    const body = {
      name: 'Acme2',
      currency: null,
      invoiceDueMode: 'NET_DAYS' as const,
      invoiceNetDays: 30,
    }
    await updateClient('c1', body)
    expect(apiRequest).toHaveBeenCalledWith('/clients/c1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  })
})
