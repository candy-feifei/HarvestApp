/**
 * 与 Nest `time-entries` 的 `range.from`（ISO）对齐，生成 7 个 UTC 日期的 YYYY-MM-DD。
 */
export function utcYmdListFromRangeStart(rangeFromIso: string, dayCount: number = 7): string[] {
  const d = new Date(rangeFromIso)
  if (Number.isNaN(d.getTime())) {
    return []
  }
  const start = new Date(d)
  start.setUTCHours(0, 0, 0, 0)
  const out: string[] = []
  for (let i = 0; i < dayCount; i++) {
    const x = new Date(start)
    x.setUTCDate(x.getUTCDate() + i)
    out.push(x.toISOString().slice(0, 10))
  }
  return out
}

export function shiftUtcYmd(ymd: string, dayDelta: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dayDelta)
  return d.toISOString().slice(0, 10)
}

/** 任意 UTC 日所在 ISO 周的周一 00:00 对应的 YYYY-MM-DD，与 Nest `startOfIsoWeek` 一致 */
export function startOfIsoWeekYmd(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  const w = d.getUTCDay()
  const add = w === 0 ? -6 : 1 - w
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().slice(0, 10)
}
