import {
  buildPageMeta,
  getSkipTake,
  toPaginatedResult,
} from './pagination.util'

describe('pagination.util', () => {
  describe('getSkipTake', () => {
    it('page 与 pageSize 至少为 1', () => {
      expect(getSkipTake(0, 0)).toEqual({ skip: 0, take: 1 })
      expect(getSkipTake(-5, -1)).toEqual({ skip: 0, take: 1 })
    })

    it('第 2 页、每页 10 条 → skip 10', () => {
      expect(getSkipTake(2, 10)).toEqual({ skip: 10, take: 10 })
    })
  })

  describe('buildPageMeta', () => {
    it('total 为 0 时 totalPages 为 0', () => {
      expect(buildPageMeta(1, 20, 0)).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      })
    })

    it('total 不能整除时 totalPages 向上取整', () => {
      expect(buildPageMeta(1, 10, 25).totalPages).toBe(3)
    })
  })

  describe('toPaginatedResult', () => {
    it('组装 data 与 meta', () => {
      const data = [{ id: 'a' }]
      expect(toPaginatedResult(data, 2, 5, 11)).toEqual({
        data,
        meta: { page: 2, pageSize: 5, total: 11, totalPages: 3 },
      })
    })
  })
})
