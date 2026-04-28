import { useMemo, useState, type ReactNode } from 'react'
import {
  DayButton,
  DayFlag,
  DayPicker,
  SelectionState,
  UI,
  useDayPicker,
} from 'react-day-picker'
import type { ClassNames, DayButtonProps, Modifiers } from 'react-day-picker'
import { Popover } from 'radix-ui'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatIsoWeekRangeEn, todayUtcYmd, ymdFromLocalDate, ymdToLocalDate } from '@/features/time/time-format'
import { shiftUtcYmd, startOfIsoWeekYmd } from '@/features/time/time-range'
import 'react-day-picker/style.css'

/**
 * 与 getClassNamesForModifiers 相同逻辑，但基准类为 DayButton，使周高亮/选中样式画在
 * 按钮上而不是仅落在 td 上（默认 DayButton 只有 day_button 基类，会盖住格子的修饰符背景）。
 */
function classNamesForDayButton(
  modifiers: Modifiers,
  classNames: ClassNames,
  modifiersClassNames: Record<string, string> | undefined,
  baseClassName: string,
): string {
  const mcn = modifiersClassNames ?? {}
  const list = (Object.entries(modifiers) as [string, boolean][])
    .filter(([, active]) => active === true)
    .reduce<string[]>(
      (acc, [key]) => {
        if (mcn[key]) {
          acc.push(mcn[key]!)
        } else if (DayFlag[key as keyof typeof DayFlag]) {
          const k = DayFlag[key as keyof typeof DayFlag]
          const v = classNames[k as keyof ClassNames]
          if (v) acc.push(v)
        } else if (SelectionState[key as keyof typeof SelectionState]) {
          const k = SelectionState[key as keyof typeof SelectionState]
          const v = classNames[k as keyof ClassNames]
          if (v) acc.push(v)
        }
        return acc
      },
      [baseClassName],
    )
  return cn(...list)
}

function WeekRangeDayButton({ className, day, modifiers, style, ...rest }: DayButtonProps) {
  const { classNames, dayPickerProps } = useDayPicker()
  return (
    <DayButton
      className={classNamesForDayButton(
        modifiers,
        classNames,
        dayPickerProps.modifiersClassNames,
        className ?? (classNames[UI.DayButton] as string),
      )}
      day={day}
      modifiers={modifiers}
      style={style}
      {...rest}
    />
  )
}

type WeekTimesheetNavProps = {
  dayKeys: string[]
  weekAnchorYmd: string
  onWeekAnchorYmd: (ymd: string) => void
  onReturnToThisWeek: () => void
  /** e.g. Pending / Approved — optional */
  statusBadges?: ReactNode
  /** Shown before the week range (e.g. "This week"). */
  rangeLabelPrefix?: string
  /** e.g. Connect Calendar — between week controls and status badges */
  endSlot?: ReactNode
}

export function WeekTimesheetNav({
  dayKeys,
  weekAnchorYmd,
  onWeekAnchorYmd,
  onReturnToThisWeek,
  statusBadges,
  rangeLabelPrefix,
  endSlot,
}: WeekTimesheetNavProps) {
  const [calOpen, setCalOpen] = useState(false)
  /** 鼠标划过的日期所在周的周一 (YMD)；有值时高亮该周，随指针移动；离开面板后清掉，仍显示已选周。 */
  const [hoverWeekStartYmd, setHoverWeekStartYmd] = useState<string | null>(null)
  const todayY = todayUtcYmd()
  const weekOfToday = startOfIsoWeekYmd(todayY)
  const isThisWeek = startOfIsoWeekYmd(weekAnchorYmd) === weekOfToday
  const rangeLabel = dayKeys.length
    ? [rangeLabelPrefix, formatIsoWeekRangeEn(dayKeys)].filter(Boolean).join(' ')
    : weekAnchorYmd

  const weekStartYmd = useMemo(() => startOfIsoWeekYmd(weekAnchorYmd), [weekAnchorYmd])

  const displayRangeStartYmd = hoverWeekStartYmd ?? weekStartYmd
  const displayRangeEndYmd = useMemo(
    () => shiftUtcYmd(displayRangeStartYmd, 6),
    [displayRangeStartYmd],
  )

  const { weekModifiers, weekModifierClassNames } = useMemo(() => {
    return {
      weekModifiers: {
        weekFirst: (d: Date) => ymdFromLocalDate(d) === displayRangeStartYmd,
        weekLast: (d: Date) => ymdFromLocalDate(d) === displayRangeEndYmd,
        weekBetween: (d: Date) => {
          const y = ymdFromLocalDate(d)
          return y > displayRangeStartYmd && y < displayRangeEndYmd
        },
        appToday: (d: Date) => ymdFromLocalDate(d) === todayY,
      } as const,
      weekModifierClassNames: {
        weekFirst:
          'z-[1] rounded-l-md bg-foreground !text-background font-semibold shadow-sm hover:!bg-foreground/90',
        weekLast:
          'z-[1] rounded-r-md bg-foreground !text-background font-semibold shadow-sm hover:!bg-foreground/90',
        weekBetween: 'z-[1] rounded-none bg-amber-100/90 font-medium text-foreground hover:bg-amber-100/95',
        appToday: 'z-[2] ring-1 ring-foreground ring-offset-0',
      } as const,
    }
  }, [displayRangeStartYmd, displayRangeEndYmd, todayY])

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="inline-flex h-9 w-80 min-w-0 max-w-full shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-white text-sm text-foreground shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-8 shrink-0 rounded-none border-r border-border"
            onClick={() => onWeekAnchorYmd(shiftUtcYmd(weekAnchorYmd, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Popover.Root
            open={calOpen}
            onOpenChange={(o) => {
              setCalOpen(o)
              if (!o) {
                setHoverWeekStartYmd(null)
              }
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="flex h-9 min-w-0 w-0 flex-1 items-center justify-center overflow-hidden px-1.5 text-center transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Select week in calendar"
              >
                <span className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5">
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 max-w-full truncate text-center font-medium" title={rangeLabel}>
                    {rangeLabel}
                  </span>
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-[min(100vw-1rem,20rem)] rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-md outline-none"
                sideOffset={6}
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onMouseLeave={() => setHoverWeekStartYmd(null)}
              >
                <DayPicker
                  mode="single"
                  weekStartsOn={1}
                  defaultMonth={ymdToLocalDate(weekAnchorYmd)}
                  onSelect={(d) => {
                    if (d) {
                      onWeekAnchorYmd(startOfIsoWeekYmd(ymdFromLocalDate(d)))
                      setCalOpen(false)
                    }
                  }}
                  onDayMouseEnter={(d) => {
                    setHoverWeekStartYmd(startOfIsoWeekYmd(ymdFromLocalDate(d)))
                  }}
                  components={{ DayButton: WeekRangeDayButton }}
                  modifiers={weekModifiers}
                  modifiersClassNames={weekModifierClassNames}
                  className="p-2 [--cell-size:2.25rem]"
                  classNames={{
                    months: 'flex',
                    month: 'w-full',
                    month_caption: 'mb-2 flex h-8 w-full items-center justify-center',
                    button_previous: cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md border-0 text-foreground',
                      'hover:bg-muted/60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
                    ),
                    button_next: cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md border-0 text-foreground',
                      'hover:bg-muted/60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
                    ),
                    weekdays: 'gap-0',
                    week: 'gap-0',
                    weekday: 'h-7 w-9 p-0 text-center text-xs font-medium text-foreground/80',
                    day: 'size-[--cell-size] p-0',
                    day_button: cn(
                      'm-0 inline-flex h-8 w-full min-w-0 max-w-9',
                      'items-center justify-center rounded-md text-sm tabular-nums text-foreground',
                      'hover:bg-muted/50',
                    ),
                    today: 'text-primary',
                    outside: 'text-muted-foreground/70',
                  }}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-8 shrink-0 rounded-none border-l border-border"
            onClick={() => onWeekAnchorYmd(shiftUtcYmd(weekAnchorYmd, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!isThisWeek ? (
          <button
            type="button"
            onClick={onReturnToThisWeek}
            className="shrink-0 whitespace-nowrap text-sm text-primary underline-offset-2 hover:underline"
          >
            Return to this week
          </button>
        ) : null}
        {statusBadges ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{statusBadges}</div>
        ) : null}
      </div>
      {endSlot ? <div className="flex shrink-0 items-center gap-2">{endSlot}</div> : null}
    </div>
  )
}
