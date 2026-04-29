export const NET_PRESETS = [15, 30, 45, 60] as const

/** 选择「Custom」时若当前为预设天数，需改成非预设值，否则 select 会显示为 Net 15/30 而非 custom */
export const NET_CUSTOM_PLACEHOLDER_DAYS = 14

export function cnTextarea(base: string) {
  return `${base} min-h-[100px] resize-y`
}

export function invoiceDueSelectValue(
  mode: 'UPON_RECEIPT' | 'NET_DAYS',
  days: number,
): string {
  if (mode === 'UPON_RECEIPT') return 'UPON_RECEIPT'
  if (NET_PRESETS.includes(days as (typeof NET_PRESETS)[number])) {
    return `NET_${days}`
  }
  return 'NET_CUSTOM'
}

export const labelCls =
  'pt-2.5 text-sm font-medium text-foreground'
export const fieldWrap = 'min-w-0'
export const inputCls =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'
export const selectCls = inputCls
