import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksPage } from './tasks-page'

const listTasks = vi.hoisted(() => vi.fn())

vi.mock('@/features/tasks/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../api')>()
  return {
    ...mod,
    listTasks,
  }
})

vi.mock('@/features/clients/api', () => ({
  fetchOrganizationContext: vi.fn().mockResolvedValue({
    organizationId: 'o1',
    memberId: 'm1',
    systemRole: 'MEMBER',
    organization: { id: 'o1', name: 'O', defaultCurrency: 'USD' },
  }),
}))

let queryClient: QueryClient

function TestRoot({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('TasksPage', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    listTasks.mockResolvedValue({ common: [], other: [] })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('加载后展示标题并触发 listTasks', async () => {
    render(
      <TestRoot>
        <TasksPage />
      </TestRoot>,
    )
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    await waitFor(() => {
      expect(listTasks).toHaveBeenCalled()
    })
  })
})
