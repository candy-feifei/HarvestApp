import type { ExpenseListItem } from '@/features/expenses/api'
import { shiftUtcYmd, startOfIsoWeekYmd } from '@/features/time/time-range'

/** 费用 `spentDate` 的 UTC 日期 YYYY-MM-DD */
function expenseUtcYmd(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function addUtcDaysFromYmd(ymd: string, n: number): string {
  return shiftUtcYmd(ymd, n)
}

export type ExpenseWeekGroup = {
  key: string
  weekStart: Date
  weekEnd: Date
  label: string
  items: ExpenseListItem[]
  total: number
}

function formatShortUtc(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/**
 * 按周聚合；周键与后端 `expenses/submit-week`、`time-entries` 一致（UTC 周一 ～ 周日）。
 * 此前用本地时区算周一会导致 `g.key` 与 `submitWeek({ weekOf })` 不等，出现「已提交但按钮仍显示 Submit」。
 */
export function groupExpensesByWeek(
  items: ExpenseListItem[],
): ExpenseWeekGroup[] {
  const map = new Map<string, ExpenseListItem[]>()
  for (const it of items) {
    const dayYmd = expenseUtcYmd(it.spentDate)
    const key = startOfIsoWeekYmd(dayYmd)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((key) => {
    const weekEndYmd = addUtcDaysFromYmd(key, 6)
    const list = map.get(key)! as ExpenseListItem[]
    const total = list.reduce((s, e) => s + Number(e.amount), 0)
    const weekStart = new Date(`${key}T00:00:00.000Z`)
    const weekEnd = new Date(`${weekEndYmd}T00:00:00.000Z`)
    return {
      key,
      weekStart,
      weekEnd,
      label: `${formatShortUtc(key)} – ${formatShortUtc(weekEndYmd)} ${weekEnd.getUTCFullYear()}`,
      items: list,
      total,
    }
  })
}

/**
 * 周标题右侧操作（与 Prisma `EntryStatus` 一致：UNSUBMITTED / SUBMITTED / APPROVED）。
 *
 * 判定顺序（互斥）：
 * 1. 本周内每条都是 APPROVED → Withdraw approval
 * 2. 任一条是 UNSUBMITTED → Submit for approval（含：仍有草稿；或已提交后新补了一条草稿）
 * 3. 无 UNSUBMITTED 且存在 SUBMITTED（待经理批） → Resubmit for approval（与 Submit 调同一 API）
 * 4. 仅 SUBMITTED+APPROVED 混合（部分行已批）时仍走 2/3，通常落在「Resubmit」
 */
export function weekExpenseApprovalAction(
  items: ExpenseListItem[],
): { kind: 'submit' | 'resubmit' | 'withdraw' } | null {
  if (items.length === 0) {
    return null
  }
  const allApproved = items.every((e) => e.status === 'APPROVED')
  if (allApproved) {
    return { kind: 'withdraw' }
  }
  const hasUnsubmitted = items.some((e) => e.status === 'UNSUBMITTED')
  if (hasUnsubmitted) {
    return { kind: 'submit' }
  }
  const hasSubmitted = items.some((e) => e.status === 'SUBMITTED')
  if (hasSubmitted) {
    return { kind: 'resubmit' }
  }
  return null
}

export function weekHeaderStatus(
  items: ExpenseListItem[],
): { label: string; className: string } {
  const hasPending = items.some((e) => e.status === 'SUBMITTED')
  const allApproved = items.length > 0 && items.every((e) => e.status === 'APPROVED')
  if (allApproved) {
    return {
      label: 'Approved',
      className: 'bg-emerald-600 text-white shadow-sm',
    }
  }
  if (hasPending) {
    return {
      label: 'Pending approval',
      className: 'bg-sky-600 text-white shadow-sm',
    }
  }
  return {
    label: 'Draft / unsubmitted',
    className:
      'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100',
  }
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
