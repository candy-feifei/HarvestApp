import { apiRequest } from '@/lib/api/http'

// --- Form options ---

export type ExpenseFormOptionsResponse = {
  projects: { id: string; name: string; clientName: string }[]
  categories: {
    id: string
    name: string
    unitName: string | null
    unitPrice: string | null
    isArchived: boolean
  }[]
  defaultCurrency: string
}

export function fetchExpenseFormOptions() {
  return apiRequest<ExpenseFormOptionsResponse>('/expenses/form-options', {
    method: 'GET',
  })
}

// --- Expense CRUD ---

export type ExpenseListItem = {
  id: string
  amount: string
  spentDate: string
  notes: string | null
  receiptUrl: string | null
  status: 'UNSUBMITTED' | 'SUBMITTED' | 'APPROVED'
  isLocked: boolean
  isBillable: boolean
  isReimbursable: boolean
  unitQuantity: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  project: { id: string; name: string; client: { id: string; name: string } }
  category: {
    id: string
    name: string
    unitName: string | null
    unitPrice: string | null
  }
  approval: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
    periodStart: string
    periodEnd: string
  } | null
}

export type ListExpensesParams = {
  userId?: string
  /** When true, list all members' expenses (manager view) */
  includeAllMembers?: boolean
  from?: string
  to?: string
}

export function listExpenses(params: ListExpensesParams = {}) {
  const sp = new URLSearchParams()
  if (params.userId) sp.set('userId', params.userId)
  if (params.includeAllMembers) sp.set('includeAllMembers', 'true')
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  const q = sp.toString()
  return apiRequest<{ items: ExpenseListItem[] }>(
    `/expenses${q ? `?${q}` : ''}`,
    { method: 'GET' },
  )
}

export type CreateExpenseRequest = {
  spentDate: string
  amount: number
  notes?: string
  receiptUrl?: string
  isBillable?: boolean
  isReimbursable?: boolean
  unitQuantity?: number
  projectId: string
  categoryId: string
}

export function createExpense(body: CreateExpenseRequest) {
  return apiRequest<ExpenseListItem>('/expenses', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Upload receipt image or PDF; returns `receiptUrl` to store (e.g. `/api/uploads/receipts/...`) */
export function uploadExpenseReceipt(file: File) {
  const body = new FormData()
  body.append('file', file)
  return apiRequest<{ receiptUrl: string }>('/uploads/receipt', {
    method: 'POST',
    body,
  })
}

export type UpdateExpenseRequest = {
  spentDate?: string
  amount?: number
  notes?: string | null
  receiptUrl?: string | null
  isBillable?: boolean
  isReimbursable?: boolean
  unitQuantity?: number | null
  projectId?: string
  categoryId?: string
}

export function updateExpense(id: string, body: UpdateExpenseRequest) {
  return apiRequest<ExpenseListItem>(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteExpense(id: string) {
  return apiRequest<{ id: string }>(`/expenses/${id}`, { method: 'DELETE' })
}

// --- Expense categories ---

export type ExpenseCategoryItem = {
  id: string
  name: string
  unitName: string | null
  unitPrice: string | null
  isArchived: boolean
  hasUnitPrice: boolean
}

export function listExpenseCategories() {
  return apiRequest<{ items: ExpenseCategoryItem[] }>('/expense-categories', {
    method: 'GET',
  })
}

export type CreateExpenseCategoryRequest = {
  name: string
  hasUnitPrice?: boolean
  unitName?: string
  unitPrice?: number
}

export function createExpenseCategory(body: CreateExpenseCategoryRequest) {
  return apiRequest<{
    id: string
    name: string
    unitName: string | null
    unitPrice: string | null
    isArchived: boolean
  }>('/expense-categories', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type UpdateExpenseCategoryRequest = {
  name?: string
  isArchived?: boolean
  hasUnitPrice?: boolean
  unitName?: string | null
  unitPrice?: number | null
}

export function updateExpenseCategory(
  id: string,
  body: UpdateExpenseCategoryRequest,
) {
  return apiRequest<{
    id: string
    name: string
    unitName: string | null
    unitPrice: string | null
    isArchived: boolean
  }>(`/expense-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteExpenseCategory(id: string) {
  return apiRequest<{ id: string; removed: true }>(
    `/expense-categories/${id}`,
    { method: 'DELETE' },
  )
}
