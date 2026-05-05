import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  copyFromRecentDay,
  createTimeEntry,
  deleteTimeEntry,
  getActiveTimeEntryTimer,
  groupAssignableRowsToTrackProjects,
  listAssignableTimeRows,
  listTimeEntries,
  listTrackTimeOptions,
  startTimeEntryTimer,
  stopTimeEntryTimer,
  submitTimeWeek,
  timeEntriesResourcePath,
  updateTimeEntry,
  withdrawTimeWeek,
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

  it('listTimeEntries: 多参数组合', async () => {
    apiRequest.mockResolvedValue({
      mode: 'month',
      range: { from: '', toExclusive: '' },
      forUser: 'u1',
      weekApproval: null,
      items: [],
    })
    await listTimeEntries({ month: '2026-04', forUser: 'other' })
    expect(apiRequest).toHaveBeenCalledWith(
      '/time-entries?month=2026-04&forUser=other',
      { method: 'GET' },
    )
  })

  it('listTrackTimeOptions: GET track-time-options', async () => {
    apiRequest.mockResolvedValue({ projects: [] })
    await listTrackTimeOptions()
    expect(apiRequest).toHaveBeenCalledWith(
      '/time-entries/track-time-options',
      { method: 'GET' },
    )
  })

  it('createTimeEntry: POST /time-entries', async () => {
    apiRequest.mockResolvedValue({ action: 'saved', item: {} })
    await createTimeEntry({
      projectTaskId: 'pt1',
      date: '2026-04-01',
      hours: 1,
      notes: 'x',
    })
    expect(apiRequest).toHaveBeenCalledWith('/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        projectTaskId: 'pt1',
        date: '2026-04-01',
        hours: 1,
        notes: 'x',
      }),
    })
  })

  it('updateTimeEntry: PATCH /time-entries/:id', async () => {
    apiRequest.mockResolvedValue({ action: 'saved', item: {} })
    await updateTimeEntry('e1', { hours: 2 })
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/e1', {
      method: 'PATCH',
      body: JSON.stringify({ hours: 2 }),
    })
  })

  it('deleteTimeEntry: DELETE /time-entries/:id', async () => {
    apiRequest.mockResolvedValue(undefined)
    await deleteTimeEntry('e1')
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/e1', {
      method: 'DELETE',
    })
  })

  it('submitTimeWeek / withdrawTimeWeek: POST 周操作', async () => {
    apiRequest.mockResolvedValue({
      lockedCount: 1,
      weekFrom: 'a',
      toExclusive: 'b',
    })
    await submitTimeWeek('2026-04-06')
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/submit-week', {
      method: 'POST',
      body: JSON.stringify({ weekOf: '2026-04-06' }),
    })
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({
      unlockedCount: 1,
      weekFrom: 'a',
      toExclusive: 'b',
    })
    await withdrawTimeWeek('2026-04-06')
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/withdraw-week', {
      method: 'POST',
      body: JSON.stringify({ weekOf: '2026-04-06' }),
    })
  })

  it('copyFromRecentDay: POST copy-from-recent-day', async () => {
    apiRequest.mockResolvedValue({
      copied: 0,
      skipped: 0,
      sourceDate: null,
      targetDate: '2026-04-02',
    })
    await copyFromRecentDay('2026-04-02')
    expect(apiRequest).toHaveBeenCalledWith(
      '/time-entries/copy-from-recent-day',
      {
        method: 'POST',
        body: JSON.stringify({ date: '2026-04-02' }),
      },
    )
  })

  it('timer: active / start / stop', async () => {
    apiRequest.mockResolvedValue({ timer: null })
    await getActiveTimeEntryTimer()
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/timer/active', {
      method: 'GET',
    })
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ timer: { id: 't1' } })
    await startTimeEntryTimer({ projectTaskId: 'pt', date: '2026-04-01' })
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/timer/start', {
      method: 'POST',
      body: JSON.stringify({ projectTaskId: 'pt', date: '2026-04-01' }),
    })
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ action: 'stopped', item: null })
    await stopTimeEntryTimer('t1')
    expect(apiRequest).toHaveBeenCalledWith('/time-entries/timer/t1/stop', {
      method: 'POST',
    })
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

  it('按 clientName、projectName 排序多个项目', () => {
    const rows = [
      {
        projectTaskId: 'pt-b',
        projectId: 'p-b',
        taskId: 't1',
        clientId: 'c2',
        clientName: 'B Client',
        projectName: 'Z',
        taskName: 'T',
      },
      {
        projectTaskId: 'pt-a',
        projectId: 'p-a',
        taskId: 't2',
        clientId: 'c1',
        clientName: 'A Client',
        projectName: 'Y',
        taskName: 'T',
      },
    ]
    const out = groupAssignableRowsToTrackProjects(rows)
    expect(out.map((p) => p.projectId)).toEqual(['p-a', 'p-b'])
  })
})
