import { apiRequest } from '@/lib/api/http'

export type OrganizationContext = {
  organizationId: string
  memberId: string
  systemRole: string
  firstName: string
  lastName: string
  email: string
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

export function updateClient(id: string, body: CreateClientPayload) {
  return apiRequest<{
    id: string
    name: string
    resolvedCurrency: string
  }>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export type ClientContactListItem = {
  id: string
  firstName: string
  lastName: string
  email: string
  title: string | null
}

export type ClientListItem = {
  id: string
  name: string
  contactCount: number
  contacts: ClientContactListItem[]
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
  /** 未归档项目，用于编辑页侧栏 */
  activeProjects?: { id: string; name: string }[]
}

export function fetchClient(id: string) {
  return apiRequest<ClientDetail>(`/clients/${id}`, { method: 'GET' })
}

export type CreateClientContactPayload = {
  firstName: string
  lastName: string
  email: string
  title?: string
  officeNumber?: string
  mobileNumber?: string
  faxNumber?: string
}

export function createClientContact(
  clientId: string,
  body: CreateClientContactPayload,
) {
  return apiRequest<{
    id: string
    clientId: string
    firstName: string
    lastName: string
    email: string
    clientName: string
  }>(`/clients/${clientId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type ClientContactDetail = {
  id: string
  clientId: string
  firstName: string
  lastName: string
  email: string
  title: string | null
  officeNumber: string | null
  faxNumber: string | null
  mobileNumber: string | null
}

export function fetchClientContact(clientId: string, contactId: string) {
  return apiRequest<ClientContactDetail>(
    `/clients/${clientId}/contacts/${contactId}`,
    { method: 'GET' },
  )
}

export function updateClientContact(
  clientId: string,
  contactId: string,
  body: CreateClientContactPayload,
) {
  return apiRequest<{ id: string; clientId: string }>(
    `/clients/${clientId}/contacts/${contactId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}
