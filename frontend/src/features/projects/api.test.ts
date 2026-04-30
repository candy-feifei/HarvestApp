import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjects, getProject, projectsResourcePath } from './api'

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

describe('projects api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('projectsResourcePath 与列表查询路径一致', () => {
    expect(projectsResourcePath).toBe('/projects')
  })

  it('getProjects: 默认分页参数', async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 })
    await getProjects()
    expect(apiRequest).toHaveBeenCalledWith('/projects?page=1&pageSize=100', {
      method: 'GET',
    })
  })

  it('getProject: GET /projects/:id', async () => {
    apiRequest.mockResolvedValue({ id: 'p1' })
    await getProject('p1')
    expect(apiRequest).toHaveBeenCalledWith('/projects/p1', { method: 'GET' })
  })
})
