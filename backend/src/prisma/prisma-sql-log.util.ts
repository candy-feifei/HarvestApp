import type { Prisma } from '@prisma/client'

/**
 * 将 Prisma `query` 事件中的 PostgreSQL 占位符 `$1`, `$2`… 用 `params` JSON 数组里的值展开，
 * 便于本地对照条件与数据（仅调试用，与真实执行在边界类型上可能略有差异）。
 */
export function expandPrismaQueryParams(query: string, params: string): string {
  let list: unknown[]
  try {
    const parsed: unknown = JSON.parse(params)
    if (!Array.isArray(parsed)) {
      return `${query}\n-- params (非数组): ${params}`
    }
    list = parsed
  } catch {
    return `${query}\n-- params (非 JSON): ${params}`
  }

  let out = query
  for (let i = list.length; i >= 1; i--) {
    const lit = formatParamAsSqlLiteral(list[i - 1])
    out = out.replace(new RegExp(`\\$${i}(?!\\d)`, 'g'), lit)
  }
  return out
}

function formatParamAsSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`
  }
  return String(value)
}

export function logPrismaQueryEvent(
  e: Prisma.QueryEvent,
  log: (msg: string) => void,
): void {
  const expanded = expandPrismaQueryParams(e.query, e.params)
  log(`[${e.duration}ms] ${e.target}\n${expanded}`)
}
