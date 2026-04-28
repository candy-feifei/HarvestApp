import { useState, type ReactNode } from 'react'
import { DayPicker } from 'react-day-picker'
import { Popover } from 'radix-ui'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Pencil,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatDecimalHoursAsClock,
  formatLongDateEn,
  todayUtcYmd,
  ymdFromLocalDate,
  ymdToLocalDate,
} from '@/features/time/time-format'
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
  /** Renders under the withdraw button (e.g. inline confirm). */
  withdrawConfirm: ReactNode
  submitButtonLabel: string
  showSubmitForApproval: boolean
  /** 为 true 时隐藏「提交周审批」按钮（已展开确认条） */
  hideSubmitTrigger?: boolean
  /** Whether the current week has any locked rows (submitted or approved). */
  canWithdraw: boolean
  /** 为 true 时隐藏「撤回审批」按钮（已展开确认条） */
  hideWithdrawTrigger?: boolean
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
  /** 当前选中日与计时中任务一致时，在已保存条目的下方显示一行「进行中」 */
  activeTimerRow: {
    clientName: string
    projectName: string
    taskName: string
    elapsedLabel: string
  } | null
  onStopTimer: () => void
  /** 左下角：从「目标日之前最近一个有工时的一天」复制到目标日 */
  copyFromRecent?: {
    onClick: () => void
    disabled: boolean
    loading: boolean
    feedback: string | null
    /** Day 视图为「最近一天」；未传时沿用原英文文案 */
    label?: string
  }
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
  withdrawConfirm,
  submitButtonLabel,
  showSubmitForApproval,
  hideSubmitTrigger = false,
  canWithdraw,
  hideWithdrawTrigger = false,
  submitLoading,
  withdrawLoading,
  dailyTotals,
  weekTotal,
  dayEntries,
  weekAllApproved,
  hasPendingApproval,
  dayLockedByYmd,
  onEditEntry,
  activeTimerRow,
  onStopTimer,
  copyFromRecent,
}: TimesheetDayPanelProps) {
  const [calOpen, setCalOpen] = useState(false)
  const todayY = todayUtcYmd()
  const isToday = selectedYmd === todayY
  const dayLabel = isToday ? `Today ${formatLongDateEn(selectedYmd)}` : formatLongDateEn(selectedYmd)
  const dayTotal = dayEntries.reduce((a: number, b: TimeEntryListItem) => a + (b.hours || 0), 0)
  /** 仅整周已批准时不可增改删；待审批 (Pending) 仍可编辑。 */
  const timeEntriesEditable = !weekAllApproved
  const showAddTrack = timeEntriesEditable
  const showListAndTotals = true
  const showApprovedMessage = weekAllApproved

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <div
              className="inline-flex h-9 w-80 min-w-0 max-w-full shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-white text-sm text-foreground shadow-sm"
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
                    className="flex h-9 min-h-0 w-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-1.5 text-center transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Select date in calendar"
                  >
                    <span className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5">
                      <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <time
                        className="min-w-0 max-w-full truncate text-center font-medium tabular-nums"
                        dateTime={selectedYmd}
                        title={dayLabel}
                      >
                        {dayLabel}
                      </time>
                    </span>
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
          </div>
          {!isToday ? (
            <button
              type="button"
              onClick={onReturnToToday}
              className="shrink-0 whitespace-nowrap text-sm text-primary underline-offset-2 hover:underline"
            >
              Return to today
            </button>
          ) : null}
          {weekAllApproved ? (
            <span
              className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              role="status"
            >
              Approved
            </span>
          ) : hasPendingApproval ? (
            <span
              className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
              role="status"
            >
              Pending approval
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,40rem)] sm:items-end">
          {showAddTrack && (
            <Button
              type="button"
              className="h-9 shrink-0 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          This timesheet has been approved. Entries are read-only.
        </div>
      ) : null}

      {showListAndTotals && (
        <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
          {dayEntries.length === 0 && !activeTimerRow && !listLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No time was logged on this day. Use &quot;+ Track time&quot; to add an entry.
            </p>
          ) : null}
          <ul className="divide-y divide-border">
            {dayEntries.map((e: TimeEntryListItem) => {
              const canEdit = timeEntriesEditable && !e.isLocked
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
                      {e.status === 'APPROVED' ? (
                        <p className="mt-0.5 flex items-center gap-0.5 text-xs text-amber-800/90">
                          <Lock className="size-3" />
                          Approved
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-none items-center justify-end gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {formatDecimalHoursAsClock(e.hours)}
                      </span>
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-primary/40 text-foreground hover:bg-primary/5"
                          onClick={() => onEditEntry(e)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
            {activeTimerRow && timeEntriesEditable && (
              <li
                key="__timer_running__"
                className="border-b border-primary/20 bg-primary/5"
                role="status"
                aria-live="polite"
              >
                <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      Timer running
                    </p>
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      {activeTimerRow.clientName}
                    </p>
                    <p className="break-words text-[15px] font-semibold text-foreground">
                      {activeTimerRow.projectName}
                    </p>
                    <p className="break-words text-sm text-muted-foreground">{activeTimerRow.taskName}</p>
                  </div>
                  <div className="flex flex-none flex-wrap items-center justify-end gap-2">
                    <span className="text-lg font-semibold tabular-nums text-primary sm:text-xl">
                      {activeTimerRow.elapsedLabel}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={onStopTimer}
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              </li>
            )}
          </ul>
          {(dayEntries.length > 0 || activeTimerRow) && (
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

      <div className="flex w-full max-w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {copyFromRecent ? (
          <div className="flex flex-col items-start gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-muted-foreground"
              onClick={copyFromRecent.onClick}
              disabled={copyFromRecent.disabled || copyFromRecent.loading}
            >
              {copyFromRecent.loading ? 'Copying…' : (copyFromRecent.label ?? 'Copy from most recent day')}
            </Button>
            {copyFromRecent.feedback ? (
              <p className="max-w-[min(100%,28rem)] text-xs text-muted-foreground">{copyFromRecent.feedback}</p>
            ) : null}
          </div>
        ) : (
          <span className="hidden sm:block sm:min-w-0 sm:flex-1" aria-hidden />
        )}
        <div className="ml-auto flex min-w-0 flex-col items-end gap-2">
        {showSubmitForApproval && !hideSubmitTrigger && (
          <div className="flex w-full justify-end">
            <Button
              type="button"
              className="w-auto shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onRequestSubmitForApproval}
              disabled={submitLoading}
            >
              {submitButtonLabel}
            </Button>
          </div>
        )}
        {canWithdraw && (
          <div className="flex w-full min-w-0 max-w-5xl flex-col items-end gap-2 self-end">
            {!hideWithdrawTrigger && (
              <Button
                type="button"
                size="default"
                variant="outline"
                className="w-auto shrink-0"
                onClick={onRequestWithdraw}
                disabled={withdrawLoading}
              >
                Withdraw
              </Button>
            )}
            {withdrawConfirm}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
