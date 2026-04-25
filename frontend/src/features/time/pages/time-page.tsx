import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, StickyNote, X } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { fetchOrganizationContext } from '@/features/clients/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AddWeekRowModal } from '@/features/time/components/add-week-row-modal'
import { WeekCellNoteDialog, WeekRowNotesDialog } from '@/features/time/components/week-notes-dialogs'
import {
  SubmitWeekConfirmBanner,
  WithdrawWeekConfirmBanner,
} from '@/features/time/components/approval-confirm-banners'
import { TrackTimeModal } from '@/features/time/components/track-time-modal'
import { TimesheetDayPanel } from '@/features/time/components/timesheet-day-panel'
import { TimesheetCalendarMonth } from '@/features/time/components/timesheet-calendar-month'
import { WeekTimesheetNav } from '@/features/time/components/week-timesheet-nav'
import { formatDecimalHoursAsClock, formatLongDateEn, todayUtcYmd } from '@/features/time/time-format'
import {
  createTimeEntry,
  deleteTimeEntry,
  listAssignableTimeRows,
  listTimeEntries,
  submitTimeWeek,
  updateTimeEntry,
  withdrawTimeWeek,
  type AssignableRow,
  type TimeEntryListItem,
} from '@/features/time/api'
import {
  shiftUtcYmd,
  startOfIsoWeekYmd,
  utcYmdListFromRangeStart,
} from '@/features/time/time-range'

type ViewMode = 'day' | 'week' | 'calendar'

function cellKey(projectTaskId: string, date: string) {
  return `${projectTaskId}\t${date}`
}

function formatShortWeekdayDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00.000Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function modalDateLabel(ymd: string) {
  return formatLongDateEn(ymd)
}

export function TimePage() {
  const queryClient = useQueryClient()
  const t0 = todayUtcYmd()
  const w0 = startOfIsoWeekYmd(t0)

  const [view, setView] = useState<ViewMode>('day')
  const [daySelectedYmd, setDaySelectedYmd] = useState(t0)
  const [weekListAnchorYmd, setWeekListAnchorYmd] = useState(w0)
  const [cellDraft, setCellDraft] = useState<Record<string, string>>({})
  const [trackOpen, setTrackOpen] = useState(false)
  const [editing, setEditing] = useState<TimeEntryListItem | null>(null)
  const [inlineTip, setInlineTip] = useState('')
  const [approvalConfirm, setApprovalConfirm] = useState<null | 'submit' | 'withdraw'>(null)
  const [weekExtraRowIds, setWeekExtraRowIds] = useState<string[]>([])
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [weekRowNotesForProjectTaskId, setWeekRowNotesForProjectTaskId] = useState<string | null>(null)
  const [weekCellNote, setWeekCellNote] = useState<{ projectTaskId: string; date: string } | null>(null)
  /** After manager withdraws, show "Resubmit" label until week changes or another submit */
  const [useResubmitLabel, setUseResubmitLabel] = useState(false)

  const { data: org } = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })
  const elevated = org
    ? org.systemRole === 'ADMINISTRATOR' || org.systemRole === 'MANAGER'
    : false

  const { data: assignable } = useQuery({
    queryKey: ['time-entries', 'assignable'],
    queryFn: listAssignableTimeRows,
  })

  const listWeekKey = useMemo(() => {
    const y = view === 'day' ? daySelectedYmd : weekListAnchorYmd
    return startOfIsoWeekYmd(y)
  }, [view, daySelectedYmd, weekListAnchorYmd])

  const { data: list, isLoading: listLoading, error: listError } = useQuery({
    queryKey: ['time-entries', 'list', listWeekKey],
    queryFn: () =>
      listTimeEntries({
        week: view === 'day' ? daySelectedYmd : weekListAnchorYmd,
      }),
  })

  const errMsg =
    listError instanceof ApiError
      ? listError.message
      : listError
        ? 'Failed to load timesheet.'
        : null

  const byCell = useMemo(() => {
    const m = new Map<string, TimeEntryListItem>()
    if (!list) return m
    for (const e of list.items) {
      m.set(cellKey(e.projectTaskId, e.date), e)
    }
    return m
  }, [list])

  const dayKeys = useMemo(() => {
    if (!list?.range?.from) {
      return []
    }
    return utcYmdListFromRangeStart(list.range.from, 7)
  }, [list?.range?.from])

  useEffect(() => {
    if (view !== 'day' || !dayKeys.length) return
    if (!dayKeys.includes(daySelectedYmd)) {
      setDaySelectedYmd(dayKeys[0]!)
    }
  }, [view, dayKeys, daySelectedYmd])

  const dayEntries = useMemo(() => {
    if (view !== 'day' || !list) {
      return []
    }
    return list.items
      .filter((e) => e.date === daySelectedYmd)
      .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.taskName.localeCompare(b.taskName))
  }, [view, list, daySelectedYmd])

  const dailyTotals = useMemo(() => {
    const t: Record<string, number> = {}
    if (!dayKeys.length || !list) return t
    for (const d of dayKeys) t[d] = 0
    for (const e of list.items) {
      if (dayKeys.includes(e.date) && e.hours) {
        t[e.date] = (t[e.date] ?? 0) + e.hours
      }
    }
    return t
  }, [list, dayKeys])

  const listWeekTotal = useMemo(
    () => (list?.items ? list.items.reduce((a, b) => a + (b.hours || 0), 0) : 0),
    [list],
  )

  const weekAllApproved = useMemo(() => {
    if (!list?.items?.length) return false
    return list.items.every((e) => e.isLocked && e.status === 'APPROVED')
  }, [list])

  const hasPendingApproval = useMemo(() => {
    if (!list?.items || weekAllApproved) return false
    return list.items.some((e) => e.isLocked && e.status === 'SUBMITTED')
  }, [list, weekAllApproved])

  const dayLockedByYmd = useMemo(() => {
    const m: Record<string, boolean> = {}
    if (!list || !dayKeys.length) return m
    for (const d of dayKeys) {
      const es = list.items.filter((e) => e.date === d)
      m[d] = es.length > 0 && es.every((e) => e.isLocked)
    }
    return m
  }, [list, dayKeys])

  const hasAnyLockedInWeek = useMemo(
    () => (list?.items?.some((e) => e.isLocked) ?? false),
    [list],
  )

  const canWithdrawWeek = elevated && hasAnyLockedInWeek

  const canSubmitForApproval = useMemo(() => {
    if (!list?.items) {
      return false
    }
    if (weekAllApproved) {
      return false
    }
    if (hasPendingApproval) {
      return false
    }
    if (listWeekTotal <= 0) {
      return false
    }
    return list.items.some((e) => !e.isLocked)
  }, [list, weekAllApproved, hasPendingApproval, listWeekTotal])

  const showTimerTip = (msg: string) => {
    setInlineTip(msg)
    void window.setTimeout(() => setInlineTip(''), 5000)
  }

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['time-entries'] })
  }, [queryClient])

  const saveCreate = useMutation({
    mutationFn: createTimeEntry,
    onSuccess: invalidate,
  })
  const saveUpdate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { hours?: number; notes?: string } }) =>
      updateTimeEntry(id, body),
    onSuccess: invalidate,
  })
  const doDelete = useMutation({
    mutationFn: deleteTimeEntry,
    onSuccess: invalidate,
  })
  const doSubmitWeek = useMutation({
    mutationFn: (weekOf: string) => submitTimeWeek(weekOf),
    onSuccess: () => {
      setUseResubmitLabel(false)
      setApprovalConfirm(null)
      invalidate()
    },
  })
  const doWithdrawWeek = useMutation({
    mutationFn: (weekOf: string) => withdrawTimeWeek(weekOf),
    onSuccess: () => {
      setUseResubmitLabel(true)
      setApprovalConfirm(null)
      invalidate()
    },
  })

  const applyCellBlur = useCallback(
    async (projectTaskId: string, date: string, raw: string) => {
      const k = cellKey(projectTaskId, date)
      const prev = byCell.get(k)
      const h = parseFloat(String(raw).replace(/,/g, ''))
      const hours = Number.isNaN(h) || h < 0 ? 0 : Math.min(24, h)
      if (prev) {
        if (prev.isLocked) {
          if (raw !== cellDraft[k]) {
            setCellDraft((c) => ({ ...c, [k]: String(prev.hours) }))
          }
          return
        }
        if (hours === 0) {
          await doDelete.mutateAsync(prev.id)
          setCellDraft((c) => {
            const n = { ...c }
            delete n[k]
            return n
          })
          return
        }
        if (hours === prev.hours) return
        await saveUpdate.mutateAsync({ id: prev.id, body: { hours } })
        return
      }
      if (hours > 0) {
        await saveCreate.mutateAsync({ projectTaskId, date, hours })
      }
    },
    [byCell, cellDraft, doDelete, saveCreate, saveUpdate],
  )

  const onNavSingleDay = (d: 1 | -1) => {
    setDaySelectedYmd((y) => shiftUtcYmd(y, d))
  }

  const onReturnToToday = () => {
    const t = todayUtcYmd()
    setDaySelectedYmd(t)
  }

  const onReturnToThisWeek = () => {
    setWeekListAnchorYmd(startOfIsoWeekYmd(todayUtcYmd()))
  }

  const onTrackSave = async (payload: {
    projectTaskId: string
    date: string
    hours: number
    notes?: string
  }) => {
    if (editing) {
      if (payload.hours === 0) {
        await doDelete.mutateAsync(editing.id)
      } else {
        await saveUpdate.mutateAsync({
          id: editing.id,
          body: { hours: payload.hours, notes: payload.notes },
        })
      }
    } else {
      if (payload.hours <= 0) {
        return
      }
      await saveCreate.mutateAsync(payload)
    }
    setTrackOpen(false)
    setEditing(null)
  }

  const getWeekOfForApi = useCallback((): string => {
    if (list?.range?.from) {
      return new Date(list.range.from).toISOString().slice(0, 10)
    }
    return view === 'day' ? daySelectedYmd : weekListAnchorYmd
  }, [list, view, daySelectedYmd, weekListAnchorYmd])

  /** Week is editable: not fully approved, not in “submitted, pending manager” state. */
  const weekGridEditable = !weekAllApproved && !hasPendingApproval

  const removeWeekRow = useCallback(
    async (projectTaskId: string) => {
      if (!weekGridEditable) {
        return
      }
      for (const d of dayKeys) {
        const e = byCell.get(cellKey(projectTaskId, d))
        if (e && !e.isLocked) {
          await doDelete.mutateAsync(e.id)
        }
      }
      setWeekExtraRowIds((ids) => ids.filter((id) => id !== projectTaskId))
    },
    [weekGridEditable, dayKeys, byCell, doDelete],
  )

  const onViewToWeek = () => {
    setView('week')
    setWeekListAnchorYmd(startOfIsoWeekYmd(daySelectedYmd))
  }

  const onViewToDay = () => {
    setView('day')
    const t = todayUtcYmd()
    setDaySelectedYmd(t)
    setWeekListAnchorYmd(startOfIsoWeekYmd(t))
  }

  const assignableRows = assignable?.rows ?? []

  const projectTaskIdsInList = useMemo(() => {
    if (!list) {
      return new Set<string>()
    }
    return new Set(list.items.map((e) => e.projectTaskId))
  }, [list])

  useEffect(() => {
    setWeekExtraRowIds((ids) => ids.filter((id) => !projectTaskIdsInList.has(id)))
  }, [projectTaskIdsInList])

  const displayedWeekRows = useMemo((): AssignableRow[] => {
    const idSet = new Set<string>([...projectTaskIdsInList, ...weekExtraRowIds])
    return assignableRows
      .filter((r) => idSet.has(r.projectTaskId))
      .sort(
        (a, b) =>
          a.clientName.localeCompare(b.clientName) ||
          a.projectName.localeCompare(b.projectName) ||
          a.taskName.localeCompare(b.taskName),
      )
  }, [assignableRows, projectTaskIdsInList, weekExtraRowIds])

  const weekRowNotesSlices = useMemo(() => {
    if (!weekRowNotesForProjectTaskId || !dayKeys.length) {
      return [] as { date: string; dateLabel: string; entry: TimeEntryListItem }[]
    }
    const r = displayedWeekRows.find((x) => x.projectTaskId === weekRowNotesForProjectTaskId)
    if (!r) {
      return []
    }
    const out: { date: string; dateLabel: string; entry: TimeEntryListItem }[] = []
    for (const d of dayKeys) {
      const e = byCell.get(cellKey(r.projectTaskId, d))
      if (!e || !e.hours || e.hours <= 0) {
        continue
      }
      out.push({ date: d, dateLabel: formatShortWeekdayDate(d), entry: e })
    }
    return out
  }, [weekRowNotesForProjectTaskId, displayedWeekRows, dayKeys, byCell])

  const weekRowNotesRowMeta = useMemo(() => {
    if (!weekRowNotesForProjectTaskId) {
      return null
    }
    return displayedWeekRows.find((x) => x.projectTaskId === weekRowNotesForProjectTaskId) ?? null
  }, [weekRowNotesForProjectTaskId, displayedWeekRows])

  /** Only project–tasks that appear on the week grid (assignable ∩ list∪extra). Excludes “orphan” list ids. */
  const usedProjectTaskIdsForAdd = useMemo(
    () => new Set(displayedWeekRows.map((r) => r.projectTaskId)),
    [displayedWeekRows],
  )

  /** + Add row: only disabled when the whole week is approved (read-only). */
  const addRowDisabled = weekAllApproved

  const weekScopeYmd =
    view === 'week' || view === 'calendar' ? weekListAnchorYmd : startOfIsoWeekYmd(daySelectedYmd)
  useEffect(() => {
    setWeekExtraRowIds([])
    setUseResubmitLabel(false)
  }, [weekScopeYmd])
  useEffect(() => {
    setApprovalConfirm(null)
  }, [view, weekScopeYmd])

  const submitWeekButtonLabel = useResubmitLabel
    ? 'Resubmit week for approval'
    : 'Submit week for approval'

  const modalYmd = editing?.date ?? daySelectedYmd

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {inlineTip ? (
        <p
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
          role="status"
        >
          {inlineTip}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Timesheet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Day and week grid entry; Calendar shows a weekly calendar by hour.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex w-full min-w-0 max-w-2xl flex-wrap items-center gap-3 sm:justify-end">
            <div className="inline-flex min-w-0 overflow-hidden rounded-md border border-border bg-white shadow-sm">
              <button
                type="button"
                className={cn(
                  'shrink-0 border-r border-border px-3 py-1.5 text-sm font-medium',
                  view === 'day' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40',
                )}
                onClick={onViewToDay}
              >
                Day
              </button>
              <button
                type="button"
                className={cn(
                  'shrink-0 border-r border-border px-3 py-1.5 text-sm font-medium',
                  view === 'week' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40',
                )}
                onClick={() => {
                  onViewToWeek()
                }}
              >
                Week
              </button>
              <button
                type="button"
                className={cn(
                  'shrink-0 px-3 py-1.5 text-sm font-medium',
                  view === 'calendar'
                    ? 'bg-orange-50 text-orange-900'
                    : 'text-muted-foreground hover:bg-muted/40',
                )}
                onClick={() => setView('calendar')}
              >
                Calendar
              </button>
            </div>
            <div className="min-w-0">
              <label className="sr-only" htmlFor="teammates-tz">
                Teammates
              </label>
              <select
                id="teammates-tz"
                disabled
                className="h-9 w-[min(8rem,100%)] min-w-0 max-w-full cursor-not-allowed rounded-md border border-border bg-white px-2 text-sm text-muted-foreground shadow-sm"
                title="Available when team list is wired"
                defaultValue="self"
              >
                <option value="self">Teammates</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {errMsg ? (
        <p className="text-sm text-destructive" role="alert">
          {errMsg}
        </p>
      ) : null}

      {(view === 'day' || view === 'week' || view === 'calendar') && approvalConfirm === 'submit' && (
        <SubmitWeekConfirmBanner
          resubmit={useResubmitLabel}
          onCancel={() => setApprovalConfirm(null)}
          onConfirm={() => void doSubmitWeek.mutateAsync(getWeekOfForApi())}
          loading={doSubmitWeek.isPending}
        />
      )}
      {(view === 'day' || view === 'week' || view === 'calendar') && approvalConfirm === 'withdraw' && canWithdrawWeek && (
        <WithdrawWeekConfirmBanner
          onCancel={() => setApprovalConfirm(null)}
          onConfirm={() => void doWithdrawWeek.mutateAsync(getWeekOfForApi())}
          loading={doWithdrawWeek.isPending}
        />
      )}

      {view === 'day' && (
        <TimesheetDayPanel
          listLoading={listLoading}
          dayKeys={dayKeys}
          selectedYmd={daySelectedYmd}
          onSelectYmd={setDaySelectedYmd}
          onNavDay={onNavSingleDay}
          onReturnToToday={onReturnToToday}
          onOpenTrack={() => {
            setEditing(null)
            setTrackOpen(true)
          }}
          onRequestSubmitForApproval={() => setApprovalConfirm('submit')}
          onRequestWithdraw={() => setApprovalConfirm('withdraw')}
          submitButtonLabel={submitWeekButtonLabel}
          showSubmitForApproval={canSubmitForApproval}
          canWithdraw={canWithdrawWeek}
          submitLoading={doSubmitWeek.isPending}
          withdrawLoading={doWithdrawWeek.isPending}
          dailyTotals={dailyTotals}
          weekTotal={listWeekTotal}
          dayEntries={dayEntries}
          weekAllApproved={weekAllApproved}
          hasPendingApproval={hasPendingApproval}
          dayLockedByYmd={dayLockedByYmd}
          onEditEntry={(e: TimeEntryListItem) => {
            setEditing(e)
            setTrackOpen(true)
          }}
          onTimerPlaceholder={showTimerTip}
        />
      )}

      {view === 'day' && (listLoading && !list) ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {view === 'week' && (
        <WeekTimesheetNav
          dayKeys={dayKeys}
          weekAnchorYmd={weekListAnchorYmd}
          onWeekAnchorYmd={setWeekListAnchorYmd}
          onReturnToThisWeek={onReturnToThisWeek}
          statusBadges={
            <>
              {hasPendingApproval && !weekAllApproved && (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                  Pending approval
                </span>
              )}
              {weekAllApproved && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Approved
                </span>
              )}
            </>
          }
        />
      )}

      {view === 'calendar' && (
        <WeekTimesheetNav
          rangeLabelPrefix="This week"
          endSlot={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled
              title="Not connected"
            >
              Connect Calendar
            </Button>
          }
          dayKeys={dayKeys}
          weekAnchorYmd={weekListAnchorYmd}
          onWeekAnchorYmd={setWeekListAnchorYmd}
          onReturnToThisWeek={onReturnToThisWeek}
          statusBadges={
            <>
              {hasPendingApproval && !weekAllApproved && (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                  Pending approval
                </span>
              )}
              {weekAllApproved && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Approved
                </span>
              )}
            </>
          }
        />
      )}

      {view === 'week' && (listLoading && !list ? <p className="text-sm text-muted-foreground">Loading…</p> : null)}
      {view === 'calendar' && (listLoading && !list ? <p className="text-sm text-muted-foreground">Loading…</p> : null)}

      {view === 'week' && list && dayKeys.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border bg-white shadow-sm">
            <table className="w-full min-w-[800px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="w-[260px] border-b border-r border-border px-2 py-2">Project / task</th>
                  {dayKeys.map((d) => {
                    const wd = new Date(`${d}T12:00:00.000Z`)
                    const wdl = wd.toLocaleDateString('en-GB', { weekday: 'short' })
                    const dLocked = weekAllApproved || dayLockedByYmd[d]
                    return (
                      <th
                        key={d}
                        className="w-[80px] border-b border-l border-border px-1 py-2 text-center font-medium"
                      >
                        <div className="mb-0.5 flex min-h-4 items-center justify-center">
                          {dLocked ? <Lock className="size-3.5 text-muted-foreground" aria-label="Day locked" /> : null}
                        </div>
                        <div className="text-foreground tabular-nums">{d.slice(5)}</div>
                        <div className="text-xs font-normal text-muted-foreground">{wdl}</div>
                      </th>
                    )
                  })}
                  <th className="w-[72px] border-b border-l border-border px-1 py-2 text-right">Row</th>
                  <th className="w-10 border-b border-l border-border px-0 py-2" aria-label="Remove row" />
                </tr>
              </thead>
              <tbody>
                {displayedWeekRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + dayKeys.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No rows yet. Add a row to log time for a project and task.
                    </td>
                  </tr>
                ) : null}
                {displayedWeekRows.map((r) => {
                  const rowSum = dayKeys.reduce((acc, d) => {
                    const e = byCell.get(cellKey(r.projectTaskId, d))
                    return acc + (e?.hours && !Number.isNaN(e.hours) ? e.hours : 0)
                  }, 0)
                  const canDel =
                    weekGridEditable &&
                    dayKeys.every((d) => !byCell.get(cellKey(r.projectTaskId, d))?.isLocked)
                  return (
                    <tr key={r.projectTaskId} className="hover:bg-muted/10">
                      <td className="border-b border-r border-border px-2 py-1.5 align-top text-sm text-foreground">
                        <div className="flex gap-2">
                          <div className="shrink-0 pt-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => setWeekRowNotesForProjectTaskId(r.projectTaskId)}
                              title="Notes for days with time (this row)"
                            >
                              <StickyNote className="size-3.5 shrink-0" aria-hidden />
                              Notes
                            </Button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 break-words font-semibold text-foreground">{r.projectName}</div>
                            <div className="line-clamp-2 text-sm text-muted-foreground">{r.taskName}</div>
                          </div>
                        </div>
                      </td>
                      {dayKeys.map((d) => {
                        const e = byCell.get(cellKey(r.projectTaskId, d))
                        const k = cellKey(r.projectTaskId, d)
                        const val =
                          (cellDraft[k] !== undefined ? cellDraft[k] : e ? String(e.hours) : '') ?? ''
                        return (
                          <td key={d} className="border-b border-l border-border p-0 align-top">
                            <div className="flex flex-col gap-0.5 p-0.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                className={cn(
                                  'h-8 w-full min-w-0 rounded border-0 border-transparent bg-transparent text-center text-sm tabular-nums',
                                  'focus:border-transparent focus:bg-muted/30 focus:ring-0 focus:outline-none',
                                  e?.isLocked ? 'cursor-not-allowed opacity-60' : '',
                                  e?.status === 'APPROVED' && 'text-emerald-800',
                                )}
                                disabled={Boolean(e?.isLocked) || saveCreate.isPending}
                                value={val}
                                onChange={(ev) => setCellDraft((c) => ({ ...c, [k]: ev.target.value }))}
                                onBlur={(ev) => {
                                  void applyCellBlur(r.projectTaskId, d, ev.target.value.trim())
                                }}
                                title={e?.isLocked ? 'Locked' : e?.status === 'SUBMITTED' ? 'Submitted' : ''}
                              />
                              <Button
                                type="button"
                                variant="link"
                                className="h-5 min-h-0 shrink-0 px-0 py-0 text-[10px] leading-tight text-muted-foreground hover:text-foreground"
                                onClick={() => setWeekCellNote({ projectTaskId: r.projectTaskId, date: d })}
                                title="Note for this day"
                              >
                                Note
                              </Button>
                            </div>
                          </td>
                        )
                      })}
                      <td className="border-b border-l border-border px-1 py-2 text-right text-sm tabular-nums text-foreground">
                        {rowSum > 0 ? formatDecimalHoursAsClock(rowSum) : '—'}
                      </td>
                      <td className="border-b border-l border-border p-0 text-center">
                        {canDel ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => void removeWeekRow(r.projectTaskId)}
                            disabled={doDelete.isPending}
                            aria-label="Remove row"
                            title="Remove row"
                          >
                            <X className="size-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-muted/20 font-medium">
                  <td className="border-b border-r border-border px-2 py-2 text-foreground">Daily total</td>
                  {dayKeys.map((d) => (
                    <td
                      key={d}
                      className="border-b border-l border-border py-2 text-center text-sm tabular-nums"
                    >
                      {formatDecimalHoursAsClock(dailyTotals[d] ?? 0)}
                    </td>
                  ))}
                  <td className="border-b border-l border-border py-2 text-right text-sm tabular-nums text-foreground">
                    {listWeekTotal > 0 ? formatDecimalHoursAsClock(listWeekTotal) : '—'}
                  </td>
                  <td className="border-b border-l border-border" />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={addRowDisabled}
              onClick={() => setAddRowOpen(true)}
            >
              + Add row
            </Button>
            <div className="flex flex-wrap items-end justify-end gap-2 sm:ml-auto">
              {canSubmitForApproval && !weekAllApproved && (
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => setApprovalConfirm('submit')}
                  disabled={doSubmitWeek.isPending}
                >
                  {submitWeekButtonLabel}
                </Button>
              )}
              {canWithdrawWeek && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setApprovalConfirm('withdraw')}
                  disabled={doWithdrawWeek.isPending}
                >
                  Withdraw approval
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'calendar' && list && dayKeys.length > 0 && (
        <div className="space-y-3">
          <TimesheetCalendarMonth
            dayKeys={dayKeys}
            items={list.items}
            dailyTotals={dailyTotals}
            weekTotal={listWeekTotal}
            dayLockedByYmd={dayLockedByYmd}
            weekAllApproved={weekAllApproved}
            onAddTime={(d) => {
              setDaySelectedYmd(d)
              setEditing(null)
              setTrackOpen(true)
            }}
            onEditEntry={(e) => {
              setEditing(e)
              setTrackOpen(true)
            }}
          />
          <div className="flex flex-wrap items-end justify-end gap-2">
            {canSubmitForApproval && !weekAllApproved && (
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setApprovalConfirm('submit')}
                disabled={doSubmitWeek.isPending}
              >
                {submitWeekButtonLabel}
              </Button>
            )}
            {canWithdrawWeek && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setApprovalConfirm('withdraw')}
                disabled={doWithdrawWeek.isPending}
              >
                Withdraw approval
              </Button>
            )}
          </div>
        </div>
      )}

      <TrackTimeModal
        open={trackOpen}
        onClose={() => {
          setTrackOpen(false)
          setEditing(null)
        }}
        dateLabel={modalDateLabel(modalYmd)}
        ymd={modalYmd}
        assignable={assignableRows}
        editing={editing}
        isSubmitting={saveCreate.isPending || saveUpdate.isPending}
        onSave={onTrackSave}
        onStartTimerRequest={() => {
          showTimerTip(
            'Background timer like Harvest is not connected. Enter your hours and use Save to record time.',
          )
        }}
      />

      <WeekRowNotesDialog
        open={weekRowNotesForProjectTaskId != null}
        onClose={() => setWeekRowNotesForProjectTaskId(null)}
        projectLabel={weekRowNotesRowMeta?.projectName ?? ''}
        taskLabel={weekRowNotesRowMeta?.taskName ?? ''}
        days={weekRowNotesSlices}
        isSaving={saveUpdate.isPending}
        onSave={async (updates) => {
          for (const u of updates) {
            await saveUpdate.mutateAsync({ id: u.id, body: { notes: u.notes } })
          }
        }}
      />

      <WeekCellNoteDialog
        open={weekCellNote != null}
        onClose={() => setWeekCellNote(null)}
        dateLabel={weekCellNote ? formatLongDateEn(weekCellNote.date) : ''}
        entry={
          weekCellNote
            ? (byCell.get(cellKey(weekCellNote.projectTaskId, weekCellNote.date)) ?? null)
            : null
        }
        isSaving={saveUpdate.isPending}
        onSave={async (id, notes) => {
          await saveUpdate.mutateAsync({ id, body: { notes } })
        }}
      />

      <AddWeekRowModal
        open={addRowOpen}
        onClose={() => setAddRowOpen(false)}
        assignable={assignableRows}
        usedProjectTaskIds={usedProjectTaskIdsForAdd}
        onAdd={(id) => {
          setWeekExtraRowIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        }}
      />
    </div>
  )
}