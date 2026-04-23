import type { ExpenseListItem } from '@/features/expenses/api'

/** Week starts on Monday (common work-week convention) */
function mondayOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = x.getDate() - day + (day === 0 ? -6 : 1)
  x.setDate(diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export type ExpenseWeekGroup = {
  key: string
  weekStart: Date
  weekEnd: Date
  label: string
  items: ExpenseListItem[]
  total: number
}

function formatShort(d: Date) {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function groupExpensesByWeek(
  items: ExpenseListItem[],
): ExpenseWeekGroup[] {
  const map = new Map<string, ExpenseListItem[]>()
  for (const it of items) {
    const d = new Date(it.spentDate)
    const m = mondayOfWeek(d)
    const key = m.toISOString().slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((key) => {
    const weekStart = new Date(key)
    const weekEnd = addDays(weekStart, 6)
    const list = map.get(key)! as ExpenseListItem[]
    const total = list.reduce((s, e) => s + Number(e.amount), 0)
    return {
      key,
      weekStart,
      weekEnd,
      label: `${formatShort(weekStart)} – ${formatShort(weekEnd)} ${weekEnd.getFullYear()}`,
      items: list,
      total,
    }
  })
}

export function weekHeaderStatus(
  items: ExpenseListItem[],
): { label: string; className: string } {
  const hasPending = items.some((e) => e.status === 'SUBMITTED')
  const allApproved = items.length > 0 && items.every((e) => e.status === 'APPROVED')
  if (allApproved) {
    return { label: 'Approved', className: 'bg-emerald-100 text-emerald-800' }
  }
  if (hasPending) {
    return { label: 'Pending approval', className: 'bg-sky-100 text-sky-800' }
  }
  return { label: 'Draft / unsubmitted', className: 'bg-slate-100 text-slate-700' }
}

export function statusLabel(
  s: ExpenseListItem['status'],
): { label: string; className: string } {
  switch (s) {
    case 'APPROVED':
      return { label: 'Approved', className: 'text-emerald-700' }
    case 'SUBMITTED':
      return { label: 'Submitted', className: 'text-sky-700' }
    default:
      return { label: 'Draft', className: 'text-slate-600' }
  }
}
