import type { Prisma } from '@prisma/client'
import {
  expandPrismaQueryParams,
  logPrismaQueryEvent,
} from './prisma-sql-log.util'

describe('prisma-sql-log.util', () => {
  describe('expandPrismaQueryParams', () => {
    it('将 $1、$2 替换为字面量', () => {
      const q = 'SELECT * FROM t WHERE a = $1 AND b = $2'
      const params = JSON.stringify(['x', 42])
      expect(expandPrismaQueryParams(q, params)).toBe(
        "SELECT * FROM t WHERE a = 'x' AND b = 42",
      )
    })

    it('字符串中单引号按 SQL 转义', () => {
      const out = expandPrismaQueryParams('SELECT $1', JSON.stringify(["O'Brien"]))
      expect(out).toContain("''")
    })

    it('params 非 JSON 时在末尾附注', () => {
      const q = 'SELECT 1'
      expect(expandPrismaQueryParams(q, 'not json')).toContain('非 JSON')
    })

    it('params 非数组时在末尾附注', () => {
      const out = expandPrismaQueryParams('SELECT 1', JSON.stringify({ a: 1 }))
      expect(out).toContain('非数组')
    })

    it('null / boolean / Date / object 格式化', () => {
      const d = new Date('2020-01-02T03:04:05.000Z')
      const params = JSON.stringify([null, true, false, d, { k: 1 }])
      const out = expandPrismaQueryParams('SELECT $1,$2,$3,$4,$5', params)
      expect(out).toContain('NULL')
      expect(out).toContain('TRUE')
      expect(out).toContain('FALSE')
      expect(out).toContain(d.toISOString())
      expect(out).toContain('{"k":1}')
    })
  })

  describe('logPrismaQueryEvent', () => {
    it('调用 log 并包含展开后的查询', () => {
      const log = jest.fn()
      const e = {
        query: 'SELECT $1',
        params: JSON.stringify(['hi']),
        duration: 3,
        target: 'db',
      } as Prisma.QueryEvent
      logPrismaQueryEvent(e, log)
      expect(log).toHaveBeenCalledWith(expect.stringContaining("'hi'"))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('[3ms]'))
    })
  })
})
