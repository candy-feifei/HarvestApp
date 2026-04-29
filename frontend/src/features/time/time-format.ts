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
 * 解析为「天内的十进制小时」用于 API：支持
 * - `2:30`、`2:5`（分钟可进位到小时，如 `3:90` → 4.5h）
 * - `3.90`：整数部分为小时、小数点后的数字为**分钟**（3h+90m → 4.5h → 显示 4:30），不是十进制小时
 * - 纯整数 `2`：整点小时
 * 空 / 无法解析 返回 0，结果限制在 0–24 h
 */
/** 运行中计时器展示：已运行毫秒数 → H:MM:SS */
export function formatElapsedMs(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return '0:00:00'
  }
  const s = Math.floor(elapsedMs / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function parseClockToDecimal(input: string): number {
  const t = input.trim().replace(/,/g, '')
  if (!t) return 0

  const colon = t.match(/^(\d+):(\d*)$/)
  if (colon) {
    const hh = parseInt(colon[1] ?? '0', 10) || 0
    const mm = parseInt((colon[2] ?? '0') || '0', 10) || 0
    const total = hh + mm / 60
    return Number.isNaN(total) || total < 0 ? 0 : Math.min(24, total)
  }

  const dot = t.match(/^(\d+)\.(\d+)$/)
  if (dot) {
    const hh = parseInt(dot[1] ?? '0', 10) || 0
    const mm = parseInt(dot[2] ?? '0', 10) || 0
    const total = hh + mm / 60
    return Number.isNaN(total) || total < 0 ? 0 : Math.min(24, total)
  }

  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10)
    return Number.isNaN(n) || n < 0 ? 0 : Math.min(24, n)
  }

  const f = parseFloat(t)
  return Number.isNaN(f) || f < 0 ? 0 : Math.min(24, f)
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
  const o: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }
  const s = start.toLocaleDateString('en-GB', o)
  const e = end.toLocaleDateString('en-GB', { ...o, year: 'numeric' })
  return `${s} – ${e}`
}
