import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDecimalHoursAsClock } from '@/features/time/time-format'
import type { TimeEntryListItem } from '@/features/time/api'

const HOUR_PX = 32
const HOURS = 24
const GRID_PX = HOUR_PX * HOURS
const ORANGE = '#ff5c00'
/** 虚线 “Add time” 在管道末端占用的「小时数」用于换算高度，不足一天剩余空间时收窄 */
const DEFAULT_ADD_SLOT_H = 1.5

type DayLayout = {
  entry: TimeEntryListItem
  startHour: number
  endHour: number
}

/**
 * 一天内依录入顺序（createdAt）堆叠，时间连续无间隙，从 0:00 起像管道向下延伸。
 */
function layoutEntriesForDay(entries: TimeEntryListItem[]): DayLayout[] {
  const sorted = [...entries]
    .filter((e) => e.hours && !Number.isNaN(e.hours) && e.hours > 0)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
  let cursor = 0
  const out: DayLayout[] = []
  for (const entry of sorted) {
    const h = Math.min(24, entry.hours)
    const startHour = cursor
    const endHour = Math.min(24, startHour + h)
    const used = endHour - startHour
    if (used <= 0) {
      break
    }
    out.push({ entry, startHour, endHour })
    cursor = endHour
    if (cursor >= 24) {
      break
    }
  }
  return out
}

function dayPipelineEndHour(layouts: DayLayout[]): number {
  if (layouts.length === 0) {
    return 0
  }
  return layouts[layouts.length - 1]!.endHour
}

type TimesheetCalendarMonthProps = {
  dayKeys: string[]
  items: TimeEntryListItem[]
  dailyTotals: Record<string, number>
  weekTotal: number
  dayLockedByYmd: Record<string, boolean>
  weekAllApproved: boolean
  /** 与周表可编辑态一致；为 false 时整周不可 + Add / 点条编辑。 */
  weekGridEditable: boolean
  onAddTime: (dateYmd: string) => void
  onEditEntry: (entry: TimeEntryListItem) => void
}

export function TimesheetCalendarMonth({
  dayKeys,
  items,
  dailyTotals,
  weekTotal,
  dayLockedByYmd,
  weekAllApproved,
  weekGridEditable,
  onAddTime,
  onEditEntry,
}: TimesheetCalendarMonthProps) {
  const byDate = (() => {
    const m = new Map<string, TimeEntryListItem[]>()
    for (const d of dayKeys) {
      m.set(d, [])
    }
    for (const e of items) {
      if (!dayKeys.includes(e.date)) {
        continue
      }
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    return m
  })()

  if (dayKeys.length === 0) {
    return <p className="text-sm text-muted-foreground">No week range.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
      <div className="min-w-[900px]">
        <div
          className="grid text-sm"
          style={{ gridTemplateColumns: `3rem repeat(${dayKeys.length}, minmax(5.5rem,1fr)) 4.5rem` }}
        >
          <div className="border-b border-r border-border bg-muted/30" />
          {dayKeys.map((d) => {
            const w = new Date(`${d}T12:00:00.000Z`)
            const line1 = w.toLocaleDateString('en-GB', { weekday: 'short' })
            const dayNum = w.getUTCDate()
            const total = formatDecimalHoursAsClock(dailyTotals[d] ?? 0)
            return (
              <div
                key={d}
                className="border-b border-r border-border bg-muted/20 px-1.5 py-2 text-center font-medium text-foreground"
              >
                <div>
                  {line1} {dayNum}
                </div>
                <div className="text-xs font-semibold tabular-nums text-muted-foreground">{total}</div>
              </div>
            )
          })}
          <div className="border-b border-border bg-muted/20 px-1.5 py-2 text-center font-medium text-foreground">
            <div>Week</div>
            <div>total</div>
            <div className="mt-0.5 text-xs font-semibold tabular-nums text-[#b45309]">
              {formatDecimalHoursAsClock(weekTotal)}
            </div>
          </div>
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: `3rem repeat(${dayKeys.length}, minmax(5.5rem,1fr)) 4.5rem` }}
        >
          <div
            className="flex flex-col border-r border-border bg-muted/10"
            style={{ minHeight: GRID_PX }}
          >
            <div className="shrink-0" style={{ height: GRID_PX }}>
              {Array.from({ length: HOURS }, (_, i) => (
                <div
                  key={i}
                  className="box-border border-b border-border/60 pr-1 text-right text-[10px] text-muted-foreground"
                  style={{ height: HOUR_PX, paddingTop: 2 }}
                >
                  {i + 1}hr
                </div>
              ))}
            </div>
          </div>

          {dayKeys.map((d) => {
            const dayItems = byDate.get(d) ?? []
            const layouts = layoutEntriesForDay(dayItems)
            const dLocked =
              !weekGridEditable || weekAllApproved || Boolean(dayLockedByYmd[d])
            const pipelineEnd = dayPipelineEndHour(layouts)
            const remainingH = 24 - pipelineEnd
            const addSlotH = !dLocked && remainingH > 0
              ? Math.min(DEFAULT_ADD_SLOT_H, remainingH)
              : 0

            return (
              <div
                key={d}
                className="relative border-r border-border bg-white"
                style={{ height: GRID_PX, minHeight: GRID_PX }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(0,0,0,0.06) 32px)',
                    height: GRID_PX,
                  }}
                />
                {layouts.map(({ entry, startHour, endHour }, layoutIdx) => {
                  const h = endHour - startHour
                  const topPct = (startHour / HOURS) * 100
                  const hPct = (h / HOURS) * 100
                  const barHeightPx = (h / HOURS) * GRID_PX
                  const isTiny = barHeightPx < 20
                  const isCompact = barHeightPx < 48
                  const canEdit = weekGridEditable && !entry.isLocked
                  const fullLabel = [
                    formatDecimalHoursAsClock(entry.hours),
                    entry.projectName,
                    entry.taskName,
                    entry.clientName,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onEditEntry(entry)}
                      title={fullLabel}
                      aria-label={fullLabel}
                      className={cn(
                        'absolute left-0.5 right-0.5 rounded-sm px-1.5 text-left text-white shadow-sm transition',
                        isTiny
                          ? 'flex items-start justify-end overflow-hidden py-px pr-0.5 pt-0.5'
                          : isCompact
                            ? 'flex w-full min-w-0 items-start overflow-hidden py-0.5'
                            : 'flex min-h-0 w-full min-w-0 flex-col items-stretch justify-start overflow-hidden py-1',
                        canEdit ? 'hover:opacity-95' : 'cursor-not-allowed opacity-75',
                      )}
                      style={{
                        top: `${topPct}%`,
                        height: `${hPct}%`,
                        backgroundColor: ORANGE,
                        // Later segments stack above earlier ones so a short block’s label isn’t
                        // painted under the next pipe segment; higher z = closer to the user.
                        zIndex: 5 + layoutIdx,
                      }}
                    >
                      {isTiny ? (
                        <span className="max-w-full truncate text-right text-[9px] font-bold leading-none tabular-nums">
                          {formatDecimalHoursAsClock(entry.hours)}
                        </span>
                      ) : isCompact ? (
                        <div className="flex min-h-0 w-full min-w-0 items-baseline justify-between gap-0.5 text-[10px] leading-tight">
                          <span className="min-w-0 flex-1 truncate text-left font-semibold">{entry.projectName}</span>
                          <span className="inline-flex shrink-0 items-baseline gap-0.5 font-bold tabular-nums">
                            {formatDecimalHoursAsClock(entry.hours)}
                            {entry.isLocked ? (
                              <Lock className="size-2.5 shrink-0 self-center opacity-90" aria-label="Locked" />
                            ) : null}
                          </span>
                        </div>
                      ) : (
                        <div className="flex min-h-0 w-full min-w-0 flex-col text-[11px] leading-tight">
                          <div className="flex shrink-0 items-start justify-end gap-1">
                            {entry.isLocked ? (
                              <Lock className="size-3.5 shrink-0 opacity-90" aria-label="Locked" />
                            ) : null}
                            <span className="font-bold tabular-nums">
                              {formatDecimalHoursAsClock(entry.hours)}
                            </span>
                          </div>
                          <div className="mt-0.5 min-w-0 [overflow-wrap:anywhere] line-clamp-2 font-semibold">
                            {entry.projectName}
                          </div>
                          <div className="min-w-0 [overflow-wrap:anywhere] line-clamp-2 text-white/95">
                            {entry.taskName}
                          </div>
                          <div className="mt-0.5 min-w-0 truncate text-[10px] text-white/75">{entry.clientName}</div>
                        </div>
                      )}
                    </button>
                  )
                })}

                {addSlotH > 0 ? (
                  <div
                    className="absolute left-0.5 right-0.5 z-20"
                    style={{
                      top: `${(pipelineEnd / HOURS) * 100}%`,
                      height: `${(addSlotH / HOURS) * 100}%`,
                      minHeight: 32,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onAddTime(d)}
                      className={cn(
                        'flex h-full w-full min-h-[32px] items-center justify-center gap-0.5 rounded border-2 border-dashed bg-white/95 py-0.5 text-[10px] font-medium text-[#c2410c]',
                        'shadow-sm hover:bg-orange-50/90',
                      )}
                      style={{ borderColor: ORANGE }}
                    >
                      + Add time
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}

          <div
            className="border-l border-border bg-muted/5"
            style={{ height: GRID_PX, minHeight: GRID_PX }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
