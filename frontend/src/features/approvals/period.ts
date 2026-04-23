import type { ReportPeriod } from './api'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function endOfWeekMonday(d: Date): Date {
  const s = startOfWeekMonday(d)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return endOfDay(e)
}

function getDayRange(anchor: Date): { from: Date; to: Date } {
  return { from: startOfDay(anchor), to: endOfDay(anchor) }
}

function getSemimonthRange(anchor: Date): { from: Date; to: Date } {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const d = anchor.getDate()
  if (d <= 15) {
    return {
      from: startOfDay(new Date(y, m, 1)),
      to: endOfDay(new Date(y, m, 15)),
    }
  }
  const last = new Date(y, m + 1, 0)
  return { from: startOfDay(new Date(y, m, 16)), to: endOfDay(last) }
}

function semimonthNavigate(anchor: Date, dir: 1 | -1): Date {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const d = anchor.getDate()
  if (dir === -1) {
    if (d <= 15) {
      const pm = m === 0 ? 11 : m - 1
      const py = m === 0 ? y - 1 : y
      return new Date(py, pm, 20)
    }
    return new Date(y, m, 8)
  }
  if (d <= 15) {
    return new Date(y, m, 20)
  }
  return new Date(y, m + 1, 8)
}

function getMonthRange(anchor: Date): { from: Date; to: Date } {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  return {
    from: startOfDay(new Date(y, m, 1)),
    to: endOfDay(new Date(y, m + 1, 0)),
  }
}

function getQuarterRange(anchor: Date): { from: Date; to: Date } {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const q = Math.floor(m / 3)
  const startM = q * 3
  const endM = startM + 2
  return {
    from: startOfDay(new Date(y, startM, 1)),
    to: endOfDay(new Date(y, endM + 1, 0)),
  }
}

function quarterNavigate(anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor)
  d.setMonth(d.getMonth() + dir * 3)
  return d
}

export function computeDateRange(
  period: ReportPeriod,
  anchor: Date,
  custom: { from: Date; to: Date } | null,
): { from: Date; to: Date } {
  switch (period) {
    case 'DAY':
      return getDayRange(anchor)
    case 'WEEK':
      return {
        from: startOfWeekMonday(anchor),
        to: endOfWeekMonday(anchor),
      }
    case 'SEMIMONTH':
      return getSemimonthRange(anchor)
    case 'MONTH':
      return getMonthRange(anchor)
    case 'QUARTER':
      return getQuarterRange(anchor)
    case 'CUSTOM': {
      if (custom) {
        return { from: startOfDay(custom.from), to: endOfDay(custom.to) }
      }
      return getDayRange(anchor)
    }
    default:
      return {
        from: startOfWeekMonday(anchor),
        to: endOfWeekMonday(anchor),
      }
  }
}

export function navigatePeriod(
  period: ReportPeriod,
  anchor: Date,
  dir: 1 | -1,
  custom: { from: Date; to: Date } | null,
): { nextAnchor: Date; nextCustom: { from: Date; to: Date } | null } {
  switch (period) {
    case 'DAY': {
      const a = new Date(anchor)
      a.setDate(a.getDate() + dir)
      return { nextAnchor: a, nextCustom: null }
    }
    case 'WEEK': {
      const a = new Date(anchor)
      a.setDate(a.getDate() + dir * 7)
      return { nextAnchor: a, nextCustom: null }
    }
    case 'SEMIMONTH': {
      return { nextAnchor: semimonthNavigate(anchor, dir), nextCustom: null }
    }
    case 'MONTH': {
      const a = new Date(anchor)
      a.setMonth(a.getMonth() + dir)
      return { nextAnchor: a, nextCustom: null }
    }
    case 'QUARTER': {
      return { nextAnchor: quarterNavigate(anchor, dir), nextCustom: null }
    }
    case 'CUSTOM': {
      if (!custom) {
        return { nextAnchor: anchor, nextCustom: null }
      }
      const from = startOfDay(custom.from)
      const to = endOfDay(custom.to)
      const daySpan =
        Math.max(
          0,
          Math.round((to.getTime() - from.getTime()) / 86_400_000),
        ) + 1
      const shift = dir * daySpan
      const nf = new Date(from)
      nf.setDate(nf.getDate() + shift)
      const nt = new Date(to)
      nt.setDate(nt.getDate() + shift)
      return { nextAnchor: anchor, nextCustom: { from: nf, to: nt } }
    }
    default: {
      const a = new Date(anchor)
      a.setDate(a.getDate() + dir * 7)
      return { nextAnchor: a, nextCustom: null }
    }
  }
}

export function formatDateRangeLabel(from: Date, to: Date): string {
  const sameY = from.getFullYear() === to.getFullYear()
  const fromOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    ...(sameY ? {} : { year: 'numeric' as const }),
  }
  const toOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  return `${from.toLocaleDateString('en-GB', fromOpts)} – ${to.toLocaleDateString('en-GB', toOpts)}`
}

/** Snaps the visible range to the one that contains "now" (for Custom, the current week). */
export function returnToCurrentRange(
  period: ReportPeriod,
  now: Date = new Date(),
): { anchor: Date; custom: { from: Date; to: Date } | null } {
  if (period === 'CUSTOM') {
    const { from, to } = computeDateRange('WEEK', now, null)
    return { anchor: now, custom: { from, to } }
  }
  return { anchor: new Date(now), custom: null }
}
