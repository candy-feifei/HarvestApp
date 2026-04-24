import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { Popover } from 'radix-ui'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Lock, Pencil, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatDecimalHoursAsClock,
  formatLongDateEn,
  todayUtcYmd,
  ymdFromLocalDate,
  ymdToLocalDate,
} from '@/features/time/time-format'
import { StartTimerConfirm } from '@/features/time/components/start-timer-confirm'
import type { TimeEntryListItem } from '@/features/time/api'
import 'react-day-picker/style.css'

type TimesheetDayPanelProps = {
  listLoading: boolean
  dayKeys: string[]
  selectedYmd: string
  onSelectYmd: (ymd: string) => void
  onNavDay: (dir: 1 | -1) => void
  onReturnToToday: () => void
  onOpenTrack: () => void
  /** Parent shows submit confirmation first, then calls API. */
  onRequestSubmitForApproval: () => void
  /** Parent shows withdraw confirmation (managers only). */
  onRequestWithdraw: () => void
  submitButtonLabel: string
  showSubmitForApproval: boolean
  /** Whether the current week has any locked rows (submitted or approved). */
  canWithdraw: boolean
  submitLoading: boolean
  withdrawLoading: boolean
  dailyTotals: Record<string, number>
  weekTotal: number
  dayEntries: TimeEntryListItem[]
  /** All entries in the current week are APPROVED and locked. */
  weekAllApproved: boolean
  /** Submitted row(s) awaiting manager approval. */
  hasPendingApproval: boolean
  /** Per-day Ymd → whether that day’s rows with hours are all locked. */
  dayLockedByYmd: Record<string, boolean>
  onEditEntry: (e: TimeEntryListItem) => void
  onTimerPlaceholder?: (msg: string) => void
}

function weekDayLabelEn(ymd: string) {
  const t = new Date(`${ymd}T12:00:00.000Z`)
  return t.toLocaleDateString('en-GB', { weekday: 'short' })
}

export function TimesheetDayPanel({
  listLoading,
  dayKeys,
  selectedYmd,
  onSelectYmd,
  onNavDay,
  onReturnToToday,
  onOpenTrack,
  onRequestSubmitForApproval,
  onRequestWithdraw,
  submitButtonLabel,
  showSubmitForApproval,
  canWithdraw,
  submitLoading,
  withdrawLoading,
  dailyTotals,
  weekTotal,
  dayEntries,
  weekAllApproved,
  hasPendingApproval,
  dayLockedByYmd,
  onEditEntry,
  onTimerPlaceholder,
}: TimesheetDayPanelProps) {
  const [timerConfirm, setTimerConfirm] = useState<TimeEntryListItem | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const todayY = todayUtcYmd()
  const isToday = selectedYmd === todayY
  const dayLabel = isToday ? `Today ${formatLongDateEn(selectedYmd)}` : formatLongDateEn(selectedYmd)
  const dayTotal = dayEntries.reduce((a: number, b: TimeEntryListItem) => a + (b.hours || 0), 0)
  const showAddTrack = !weekAllApproved
  const showListAndTotals = !weekAllApproved
  const showApprovedMessage = weekAllApproved

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div
            className="inline-flex h-9 min-w-0 max-w-full items-stretch overflow-hidden rounded-md border border-border bg-white text-sm text-foreground shadow-sm"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-9 w-8 shrink-0 rounded-none border-r border-border"
              onClick={() => onNavDay(-1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Popover.Root open={calOpen} onOpenChange={setCalOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Select date in calendar"
                >
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <time className="min-w-0 font-medium" dateTime={selectedYmd}>
                    {dayLabel}
                  </time>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 w-[min(100vw-1rem,20rem)] rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-md outline-none"
                  sideOffset={6}
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <DayPicker
                    key={selectedYmd}
                    mode="single"
                    weekStartsOn={1}
                    selected={ymdToLocalDate(selectedYmd)}
                    defaultMonth={ymdToLocalDate(selectedYmd)}
                    onSelect={(d) => {
                      if (d) {
                        onSelectYmd(ymdFromLocalDate(d))
                        setCalOpen(false)
                      }
                    }}
                    className="p-2 [--cell-size:2.25rem]"
                    modifiersClassNames={{
                      selected: 'bg-amber-100/90 font-medium !text-foreground ring-1 ring-foreground/15',
                    }}
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
                      weekday: 'h-7 w-9 p-0 text-center text-xs font-medium text-foreground/80',
                      day: 'size-[--cell-size] p-0',
                      day_button: cn(
                        'inline-flex h-full w-full min-w-9 max-w-9 items-center justify-center',
                        'rounded-md text-sm tabular-nums text-foreground',
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
              onClick={() => onNavDay(1)}
              aria-label="Next day"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {!isToday ? (
            <button
              type="button"
              onClick={onReturnToToday}
              className="shrink-0 text-sm text-primary underline-offset-2 hover:underline"
            >
              Return to today
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {weekAllApproved ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Approved
            </span>
          ) : hasPendingApproval ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
              Pending approval
            </span>
          ) : null}
          {showAddTrack && (
            <Button
              type="button"
              className="h-9 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onOpenTrack}
            >
              + Track time
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border-y border-border bg-white">
        <div className="flex min-w-[min(100%,800px)] items-stretch">
          {dayKeys.map((d: string) => {
            const t = formatDecimalHoursAsClock(dailyTotals[d] ?? 0)
            const isSel = d === selectedYmd
            const isRealToday = d === todayY
            const wk = weekDayLabelEn(d)
            const dayLocked = weekAllApproved || dayLockedByYmd[d]
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectYmd(d)}
                className={cn(
                  'flex-1 min-w-0 border-l border-border px-1 py-2 text-center first:border-l-0',
                  isSel ? 'bg-primary/5' : 'hover:bg-muted/20',
                )}
              >
                <p
                  className={cn(
                    'text-xs font-medium',
                    isSel && 'text-primary',
                    !isSel && isRealToday && 'text-primary',
                    !isSel && !isRealToday && 'text-muted-foreground',
                  )}
                >
                  <span className={cn('inline-block', isSel && 'border-b-2 border-primary pb-0.5')}>
                    {wk}
                  </span>
                </p>
                <p
                  className={cn(
                    'mt-1 flex items-center justify-center gap-0.5 text-sm tabular-nums',
                    isSel && 'font-semibold text-foreground',
                    !isSel && isRealToday && 'text-primary',
                    !isSel && !isRealToday && 'text-muted-foreground',
                  )}
                >
                  {t}
                  {dayLocked ? (
                    <Lock className="size-3.5 text-muted-foreground" aria-label="locked" />
                  ) : (
                    <TrendingUp
                      className="size-3.5 text-primary/80"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  )}
                </p>
              </button>
            )
          })}
          <div className="flex w-[100px] shrink-0 items-center justify-center border-l border-border bg-muted/10 px-1 py-2 text-sm">
            <div className="text-center text-muted-foreground">
              <div className="text-[10px] uppercase">Week total</div>
              <div className="mt-0.5 font-medium tabular-nums text-foreground">
                {formatDecimalHoursAsClock(weekTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {listLoading && !dayKeys.length ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {showApprovedMessage ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-border/80 bg-amber-50/40 px-4 py-16 text-center dark:bg-amber-950/10">
          <p className="text-sm font-medium text-muted-foreground">
            This timesheet has been approved.
          </p>
        </div>
      ) : null}

      {showListAndTotals && (
        <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
          {dayEntries.length === 0 && !listLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No time was logged on this day. Use &quot;+ Track time&quot; to add an entry.
            </p>
          ) : null}
          <ul className="divide-y divide-border">
            {dayEntries.map((e: TimeEntryListItem) => {
              return (
                <li key={e.id} className="hover:bg-muted/5">
                  <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{e.clientName}</p>
                      <p className="truncate text-[15px] font-semibold text-foreground">{e.projectName}</p>
                      <p className="text-sm text-muted-foreground">{e.taskName}</p>
                      {e.notes ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.notes}</p>
                      ) : null}
                      {e.isLocked && (
                        <p className="mt-0.5 flex items-center gap-0.5 text-xs text-amber-800/90">
                          <Lock className="size-3" />
                          {e.status}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-none items-center justify-end gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {formatDecimalHoursAsClock(e.hours)}
                      </span>
                      <div className="relative inline-flex items-center gap-1">
                        {timerConfirm?.id === e.id && (
                          <div className="absolute right-0 top-full z-50 w-[min(18rem,85vw)] pt-1 sm:w-80">
                            <StartTimerConfirm
                              className="relative right-0 w-full"
                              open
                              onClose={() => setTimerConfirm(null)}
                              onCancel={() => {
                                onTimerPlaceholder?.('Cancelled')
                                setTimerConfirm(null)
                              }}
                              onRestart={() => {
                                onTimerPlaceholder?.('Timer is not available yet')
                                setTimerConfirm(null)
                              }}
                              onStartOnToday={() => {
                                onReturnToToday()
                                onTimerPlaceholder?.('Jumped to today')
                                setTimerConfirm(null)
                              }}
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            if (!isToday) {
                              setTimerConfirm((v) => (v?.id === e.id ? null : e))
                            } else {
                              onTimerPlaceholder?.('Timer is not available yet. Save hours to record time.')
                            }
                          }}
                        >
                          <Clock className="size-3.5" />
                          Start
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => onEditEntry(e)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {dayEntries.length > 0 && (
            <div className="flex border-t border-border bg-muted/10 px-3 py-2.5 sm:justify-end">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Total for day</span>
                <span className="ml-2 font-semibold tabular-nums text-foreground">
                  {formatDecimalHoursAsClock(dayTotal)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {showSubmitForApproval && !weekAllApproved && (
          <Button
            type="button"
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onRequestSubmitForApproval}
            disabled={submitLoading}
          >
            {submitButtonLabel}
          </Button>
        )}
        {canWithdraw && (
          <Button
            type="button"
            size="default"
            variant="outline"
            onClick={onRequestWithdraw}
            disabled={withdrawLoading}
          >
            Withdraw approval
          </Button>
        )}
      </div>
    </div>
  )
}
