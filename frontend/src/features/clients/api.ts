import { apiRequest } from '@/lib/api/http'

export type OrganizationContext = {
  organizationId: string
  memberId: string
  systemRole: string
  organization: {
    id: string
    name: string
    defaultCurrency: string
  }
}

export function fetchOrganizationContext() {
  return apiRequest<OrganizationContext>('/organizations/context', {
    method: 'GET',
  })
}

export type CreateClientPayload = {
  name: string
  address?: string
  /** null 表示与组织账户默认货币一致 */
  currency: string | null
  invoiceDueMode: 'UPON_RECEIPT' | 'NET_DAYS'
  invoiceNetDays?: number
  taxRate?: number
  secondaryTaxEnabled?: boolean
  secondaryTaxRate?: number
  discountRate?: number
}

export function createClient(body: CreateClientPayload) {
  return apiRequest<{
    id: string
    name: string
    resolvedCurrency: string
  }>('/clients', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type ClientListItem = {
  id: string
  name: string
  contactCount: number
}

export function listClients(q?: string) {
  const path =
    q != null && q.trim() !== ''
      ? `/clients?${new URLSearchParams({ q: q.trim() })}`
      : '/clients'
  return apiRequest<{ items: ClientListItem[] }>(path, { method: 'GET' })
}

export type ClientDetail = {
  id: string
  name: string
  address: string | null
  organizationId: string
  currency: string | null
  taxRate: string | null
  secondaryTaxRate: string | null
  discountRate: string | null
  invoiceDueMode: string
  invoiceNetDays: number | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
  resolvedCurrency: string
}

export function fetchClient(id: string) {
  return apiRequest<ClientDetail>(`/clients/${id}`, { method: 'GET' })
}
