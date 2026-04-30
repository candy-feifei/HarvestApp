import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  groupAssignableRowsToTrackProjects,
  listAssignableTimeRows,
  listTimeEntries,
  timeEntriesResourcePath,
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

describe('time api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('timeEntriesResourcePath', () => {
    expect(timeEntriesResourcePath).toBe('/time-entries')
  })

  it('listAssignableTimeRows: GET assignable-rows', async () => {
    apiRequest.mockResolvedValue({ rows: [] })
    await listAssignableTimeRows()
    expect(apiRequest).toHaveBeenCalledWith(
      '/time-entries/assignable-rows',
      { method: 'GET' },
    )
  })

  it('listTimeEntries: 带 week 查询串', async () => {
    apiRequest.mockResolvedValue({
      mode: 'week',
      range: { from: '', toExclusive: '' },
      forUser: 'u1',
      weekApproval: null,
      items: [],
    })
    await listTimeEntries({ week: '2026-04-06' })
    expect(apiRequest).toHaveBeenCalledWith(
      '/time-entries?week=2026-04-06',
      { method: 'GET' },
    )
  })
})

describe('groupAssignableRowsToTrackProjects', () => {
  it('按项目聚合并排序任务名', () => {
    const rows = [
      {
        projectTaskId: 'pt2',
        projectId: 'p1',
        taskId: 't2',
        clientId: 'c1',
        clientName: 'B',
        projectName: 'Proj',
        taskName: 'Beta',
      },
      {
        projectTaskId: 'pt1',
        projectId: 'p1',
        taskId: 't1',
        clientId: 'c1',
        clientName: 'B',
        projectName: 'Proj',
        taskName: 'Alpha',
      },
    ]
    const out = groupAssignableRowsToTrackProjects(rows)
    expect(out).toHaveLength(1)
    expect(out[0]!.tasks.map((t) => t.taskName)).toEqual(['Alpha', 'Beta'])
  })
})
