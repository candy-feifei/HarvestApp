/** 将小数小时转为 "H:MM"（如 2.5 → 2:30，0 → 0:00） */
export function formatDecimalHoursAsClock(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours) || hours <= 0) {
    return '0:00'
  }
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  const mClamped = m === 60 ? 0 : m
  const hAdj = m === 60 ? h + 1 : h
  return `${hAdj}:${String(mClamped).padStart(2, '0')}`
}

/**
 * 解析 "2:30"、"2" 为小时小数；空 / 无法解析 返回 0
 */
export function parseClockToDecimal(input: string): number {
  const t = input.trim()
  if (!t) return 0
  const m = t.match(/^(\d+):(\d{0,2})$/)
  if (m) {
    const hh = parseInt(m[1] ?? '0', 10) || 0
    const mm = parseInt((m[2] ?? '0') || '0', 10) || 0
    return Math.min(24, hh + mm / 60)
  }
  const n = parseFloat(t.replace(/,/g, ''))
  return Number.isNaN(n) || n < 0 ? 0 : Math.min(24, n)
}

export function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

/** e.g. "Sunday, 26 Apr" (en-GB style) */
export function formatLongDateEn(ymd: string): string {
  const t = new Date(`${ymd}T12:00:00.000Z`)
  return t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

/** Picker + civil YMD: local calendar from Y-M-D. */
export function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date()
  return new Date(y, m - 1, d)
}

export function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** e.g. "27 Apr – 3 May 2026" (Mon–Sun from dayKeys) */
export function formatIsoWeekRangeEn(dayKeys: string[]): string {
  if (dayKeys.length === 0) {
    return ''
  }
  const d0 = dayKeys[0]!
  const d6 = dayKeys[6] ?? d0
  const start = new Date(`${d0}T12:00:00.000Z`)
  const end = new Date(`${d6}T12:00:00.000Z`)
  const s = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}
