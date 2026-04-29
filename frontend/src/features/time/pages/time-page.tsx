import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  formatDecimalHoursAsClock,
  formatElapsedMs,
  formatLongDateEn,
  parseClockToDecimal,
  todayUtcYmd,
} from '@/features/time/time-format'
import {
  createTimeEntry,
  deleteTimeEntry,
  getActiveTimeEntryTimer,
  listAssignableTimeRows,
  listTimeEntries,
  listTrackTimeOptions,
  startTimeEntryTimer,
  stopTimeEntryTimer,
  submitTimeWeek,
  updateTimeEntry,
  withdrawTimeWeek,
  copyFromRecentDay,
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

function buildEntriesByCell(items: TimeEntryListItem[]): Map<string, TimeEntryListItem[]> {
  const m = new Map<string, TimeEntryListItem[]>()
  for (const e of items) {
    const k = cellKey(e.projectTaskId, e.date)
    const arr = m.get(k) ?? []
    arr.push(e)
    m.set(k, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.id.localeCompare(b.id))
  }
  return m
}

function cellHoursSum(entries: TimeEntryListItem[] | undefined): number {
  return (entries ?? []).reduce((a, e) => a + (e.hours || 0), 0)
}

function parseCellHours(raw: string): number {
  return parseClockToDecimal(String(raw))
}

type ActiveTimerState = {
  id: string
  projectTaskId: string
  date: string
  startedAt: number
  notes?: string
  clientName: string
  projectName: string
  taskName: string
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
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(null)
  const [timerTick, setTimerTick] = useState(0)
  const activeTimerRef = useRef<ActiveTimerState | null>(null)
  const [approvalConfirm, setApprovalConfirm] = useState<null | 'submit' | 'withdraw'>(null)
  const [weekExtraRowIds, setWeekExtraRowIds] = useState<string[]>([])
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [weekRowNotesForProjectTaskId, setWeekRowNotesForProjectTaskId] = useState<string | null>(null)
  const [weekCellNoteTarget, setWeekCellNoteTarget] = useState<{
    ymd: string
    entry: TimeEntryListItem | null
  } | null>(null)
  const [copyRecentFeedback, setCopyRecentFeedback] = useState<string | null>(null)
  useEffect(() => {
    activeTimerRef.current = activeTimer
  }, [activeTimer])
  useEffect(() => {
    if (!activeTimer) return
    const id = window.setInterval(() => setTimerTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeTimer])
  const timerElapsedLabel = useMemo(() => {
    if (!activeTimer) return null
    return formatElapsedMs(Date.now() - activeTimer.startedAt)
  }, [activeTimer, timerTick])

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

  const { data: trackTimeOptions, isLoading: trackTimeOptionsLoading } = useQuery({
    queryKey: ['time-entries', 'track-time-options'],
    queryFn: listTrackTimeOptions,
    enabled: trackOpen,
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

  useEffect(() => {
    setCopyRecentFeedback(null)
  }, [listWeekKey])

  const { data: activeTimerDb } = useQuery({
    queryKey: ['time-entries', 'timer', 'active'],
    queryFn: getActiveTimeEntryTimer,
  })

  const errMsg =
    listError instanceof ApiError
      ? listError.message
      : listError
        ? 'Failed to load timesheet.'
        : null

  const entriesByCell = useMemo(
    () => (list ? buildEntriesByCell(list.items) : new Map<string, TimeEntryListItem[]>()),
    [list],
  )

  useEffect(() => {
    const t = activeTimerDb?.timer
    if (!t) return
    const next: ActiveTimerState = {
      id: t.id,
      projectTaskId: t.projectTaskId,
      date: t.date,
      startedAt: new Date(t.startedAt).getTime(),
      notes: t.notes ?? undefined,
      clientName: t.clientName,
      projectName: t.projectName,
      taskName: t.taskName,
    }
    setActiveTimer(next)
    activeTimerRef.current = next
  }, [activeTimerDb?.timer])

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

  /** 以 list.weekApproval（approvals 表）为准：有且 PENDING/… 时编辑；有且 APPROVED 时整周只读、不提交、可 Withdraw。 */
  const weekLockedByApproval = useMemo(
    () => list?.weekApproval?.status === 'APPROVED',
    [list?.weekApproval?.status],
  )

  const hasWeekApprovalPending = useMemo(
    () => list?.weekApproval?.status === 'PENDING',
    [list?.weekApproval?.status],
  )

  const weekGridEditable = !weekLockedByApproval

  /** 与整周是否被审批锁定一致（不按「单日是否全为 APPROVED 行」推断）。 */
  const dayLockedByYmd = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const d of dayKeys) {
      m[d] = weekLockedByApproval
    }
    return m
  }, [dayKeys, weekLockedByApproval])

  const canSubmitForApproval = useMemo(() => {
    if (!list?.items) {
      return false
    }
    if (weekLockedByApproval) {
      return false
    }
    if (listWeekTotal <= 0) {
      return false
    }
    return true
  }, [list, weekLockedByApproval, listWeekTotal])

  const showWithdrawWeekAction = useMemo(
    () => elevated && weekLockedByApproval,
    [elevated, weekLockedByApproval],
  )
  const showSubmitWeekForApproval = canSubmitForApproval

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
      setApprovalConfirm(null)
      invalidate()
    },
  })
  const doWithdrawWeek = useMutation({
    mutationFn: (weekOf: string) => withdrawTimeWeek(weekOf),
    onSuccess: () => {
      setApprovalConfirm(null)
      invalidate()
    },
  })
  const doCopyFromRecent = useMutation({
    mutationFn: (ymd: string) => copyFromRecentDay(ymd),
    onSuccess: (res) => {
      invalidate()
      setCopyRecentFeedback(res.message ? res.message : null)
    },
    onError: (e) => {
      setCopyRecentFeedback(e instanceof ApiError ? e.message : 'Copy failed.')
    },
  })

  const stopRunningTimer = useCallback(async () => {
    const t = activeTimerRef.current
    if (!t) {
      return
    }
    try {
      await stopTimeEntryTimer(t.id)
      invalidate()
    } finally {
      setActiveTimer(null)
      activeTimerRef.current = null
    }
  }, [invalidate])

  const handleStartTimerFromModal = useCallback(
    async (payload: {
      projectTaskId: string
      date: string
      notes?: string
      clientName: string
      projectName: string
      taskName: string
    }) => {
      if (weekLockedByApproval) {
        return
      }
      await stopRunningTimer()
      const res = await startTimeEntryTimer({
        projectTaskId: payload.projectTaskId,
        date: payload.date,
        notes: payload.notes,
      })
      const next: ActiveTimerState = {
        id: res.timer.id,
        projectTaskId: res.timer.projectTaskId,
        date: res.timer.date,
        startedAt: new Date(res.timer.startedAt).getTime(),
        notes: res.timer.notes ?? undefined,
        clientName: res.timer.clientName,
        projectName: res.timer.projectName,
        taskName: res.timer.taskName,
      }
      setActiveTimer(next)
      activeTimerRef.current = next
      setTrackOpen(false)
    },
    [stopRunningTimer, weekLockedByApproval],
  )

  const handleStopTimer = useCallback(() => {
    void stopRunningTimer()
  }, [stopRunningTimer])

  const applyCellBlur = useCallback(
    async (projectTaskId: string, date: string, raw: string) => {
      if (weekLockedByApproval) {
        return
      }
      const k = cellKey(projectTaskId, date)
      const listForCell = entriesByCell.get(k) ?? []
      const hours = parseClockToDecimal(raw)
      const clearCellDraft = () => {
        setCellDraft((c) => {
          if (!(k in c)) {
            return c
          }
          const n = { ...c }
          delete n[k]
          return n
        })
      }
      if (listForCell.some((e) => e.isLocked)) {
        clearCellDraft()
        return
      }
      if (listForCell.length > 1) {
        clearCellDraft()
        return
      }
      if (listForCell.length === 1) {
        const prev = listForCell[0]!
        if (hours === 0) {
          await doDelete.mutateAsync(prev.id)
          clearCellDraft()
          return
        }
        if (Math.abs(hours - (prev.hours || 0)) < 0.0001) {
          clearCellDraft()
          return
        }
        await saveUpdate.mutateAsync({ id: prev.id, body: { hours } })
        clearCellDraft()
        return
      }
      if (listForCell.length === 0 && hours === 0) {
        clearCellDraft()
        return
      }
      if (hours > 0) {
        await saveCreate.mutateAsync({ projectTaskId, date, hours })
        clearCellDraft()
      }
    },
    [entriesByCell, doDelete, saveCreate, saveUpdate, weekLockedByApproval],
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
    if (weekLockedByApproval) {
      setTrackOpen(false)
      setEditing(null)
      return
    }
    await stopRunningTimer()
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

  const onTrackDelete = useCallback(async () => {
    if (!editing) {
      return
    }
    if (weekLockedByApproval) {
      setTrackOpen(false)
      setEditing(null)
      return
    }
    await doDelete.mutateAsync(editing.id)
    setTrackOpen(false)
    setEditing(null)
  }, [editing, doDelete, weekLockedByApproval])

  const getWeekOfForApi = useCallback((): string => {
    if (list?.range?.from) {
      return new Date(list.range.from).toISOString().slice(0, 10)
    }
    return view === 'day' ? daySelectedYmd : weekListAnchorYmd
  }, [list, view, daySelectedYmd, weekListAnchorYmd])

  const copyTargetYmd = useMemo(() => {
    const t = todayUtcYmd()
    if (view === 'day') {
      return daySelectedYmd
    }
    if (dayKeys.length && dayKeys.includes(t)) {
      return t
    }
    return dayKeys[0] ?? t
  }, [view, daySelectedYmd, dayKeys])

  const runCopyFromRecent = useCallback(() => {
    setCopyRecentFeedback(null)
    if (view === 'day' || view === 'week') {
      void doCopyFromRecent.mutateAsync(copyTargetYmd)
    }
  }, [view, doCopyFromRecent, copyTargetYmd])

  const copyFromRecentProps = useMemo(
    () => ({
      onClick: runCopyFromRecent,
      disabled: !list || listLoading,
      loading: doCopyFromRecent.isPending,
      feedback: copyRecentFeedback,
      label: 'Copy from most recent day',
    }),
    [runCopyFromRecent, list, listLoading, doCopyFromRecent.isPending, copyRecentFeedback],
  )

  const showWeekCopyFromRecentDay = view === 'week' && !weekLockedByApproval && listWeekTotal <= 0

  const removeWeekRow = useCallback(
    async (projectTaskId: string) => {
      if (!weekGridEditable) {
        return
      }
      for (const d of dayKeys) {
        const list = entriesByCell.get(cellKey(projectTaskId, d)) ?? []
        for (const e of list) {
          if (!e.isLocked) {
            await doDelete.mutateAsync(e.id)
          }
        }
      }
      setWeekExtraRowIds((ids) => ids.filter((id) => id !== projectTaskId))
    },
    [weekGridEditable, dayKeys, entriesByCell, doDelete],
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
      const list = entriesByCell.get(cellKey(r.projectTaskId, d)) ?? []
      const e = list.find((x) => (x.hours || 0) > 0) ?? list[0]
      if (!e || !e.hours || e.hours <= 0) {
        continue
      }
      out.push({ date: d, dateLabel: formatShortWeekdayDate(d), entry: e })
    }
    return out
  }, [weekRowNotesForProjectTaskId, displayedWeekRows, dayKeys, entriesByCell])

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

  /** + Add row: only when the week is editable (not approved / not pending approval). */
  const addRowDisabled = !weekGridEditable

  const weekScopeYmd =
    view === 'week' || view === 'calendar' ? weekListAnchorYmd : startOfIsoWeekYmd(daySelectedYmd)
  useEffect(() => {
    setWeekExtraRowIds([])
  }, [weekScopeYmd])
  useEffect(() => {
    setApprovalConfirm(null)
  }, [view, weekScopeYmd])

  useEffect(() => {
    if (!weekLockedByApproval) {
      return
    }
    if (!activeTimer) {
      return
    }
    void stopRunningTimer()
  }, [weekLockedByApproval, activeTimer, stopRunningTimer])

  useEffect(() => {
    if (weekLockedByApproval) {
      setTrackOpen(false)
      setEditing(null)
    }
  }, [weekLockedByApproval])

  const submitWeekButtonLabel = hasWeekApprovalPending
    ? 'Resubmit week for approval'
    : 'Submit week for approval'

  const modalYmd = editing?.date ?? daySelectedYmd

  const activeTimerRowForDay = useMemo(() => {
    if (weekLockedByApproval || !activeTimer || activeTimer.date !== daySelectedYmd) {
      return null
    }
    if (timerElapsedLabel == null) {
      return null
    }
    return {
      clientName: activeTimer.clientName,
      projectName: activeTimer.projectName,
      taskName: activeTimer.taskName,
      elapsedLabel: timerElapsedLabel,
    }
  }, [weekLockedByApproval, activeTimer, daySelectedYmd, timerElapsedLabel])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
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
          className="w-full min-w-0 max-w-5xl"
          resubmit={hasWeekApprovalPending}
          onCancel={() => setApprovalConfirm(null)}
          onConfirm={() => void doSubmitWeek.mutateAsync(getWeekOfForApi())}
          loading={doSubmitWeek.isPending}
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
            if (weekLockedByApproval) {
              return
            }
            setEditing(null)
            setTrackOpen(true)
          }}
          onRequestSubmitForApproval={() => setApprovalConfirm('submit')}
          onRequestWithdraw={() => setApprovalConfirm('withdraw')}
          withdrawConfirm={
            approvalConfirm === 'withdraw' ? (
              <WithdrawWeekConfirmBanner
                className="w-full min-w-0"
                onCancel={() => setApprovalConfirm(null)}
                onConfirm={() => void doWithdrawWeek.mutateAsync(getWeekOfForApi())}
                loading={doWithdrawWeek.isPending}
              />
            ) : null
          }
          submitButtonLabel={submitWeekButtonLabel}
          showSubmitForApproval={showSubmitWeekForApproval}
          canWithdraw={showWithdrawWeekAction}
          hideSubmitTrigger={approvalConfirm === 'submit'}
          hideWithdrawTrigger={approvalConfirm === 'withdraw'}
          submitLoading={doSubmitWeek.isPending}
          withdrawLoading={doWithdrawWeek.isPending}
          dailyTotals={dailyTotals}
          weekTotal={listWeekTotal}
          dayEntries={dayEntries}
          weekAllApproved={weekLockedByApproval}
          hasPendingApproval={hasWeekApprovalPending}
          dayLockedByYmd={dayLockedByYmd}
          onEditEntry={(e: TimeEntryListItem) => {
            if (weekLockedByApproval || e.isLocked) {
              return
            }
            setEditing(e)
            setTrackOpen(true)
          }}
          activeTimerRow={activeTimerRowForDay}
          onStopTimer={handleStopTimer}
          copyFromRecent={weekLockedByApproval ? undefined : copyFromRecentProps}
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
              {hasWeekApprovalPending && !weekLockedByApproval && (
                <span
                  className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                  role="status"
                >
                  Pending approval
                </span>
              )}
              {weekLockedByApproval && (
                <span
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                  role="status"
                >
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
              {hasWeekApprovalPending && !weekLockedByApproval && (
                <span
                  className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                  role="status"
                >
                  Pending approval
                </span>
              )}
              {weekLockedByApproval && (
                <span
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                  role="status"
                >
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
            <table className="w-full min-w-[920px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="w-[260px] border-b border-r border-border px-2 py-2">Project</th>
                  {dayKeys.map((d) => {
                    const wd = new Date(`${d}T12:00:00.000Z`)
                    const wdl = wd.toLocaleDateString('en-GB', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    })
                    const dLocked = weekLockedByApproval || dayLockedByYmd[d]
                    return (
                      <th
                        key={d}
                        className="w-[100px] min-w-[5.5rem] border-b border-l border-border px-1 py-2 text-center font-medium"
                      >
                        <div className="mb-0.5 flex min-h-4 items-center justify-center">
                          {dLocked ? <Lock className="size-3.5 text-muted-foreground" aria-label="Day locked" /> : null}
                        </div>
                        <div className="text-foreground tabular-nums">
                          {d.slice(5, 7)}/{d.slice(8, 10)}
                        </div>
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
                    const list = entriesByCell.get(cellKey(r.projectTaskId, d)) ?? []
                    return acc + cellHoursSum(list)
                  }, 0)
                  const canDel =
                    weekGridEditable &&
                    dayKeys.every((d) => {
                      const list = entriesByCell.get(cellKey(r.projectTaskId, d)) ?? []
                      if (list.length === 0) return true
                      return list.every((e) => !e.isLocked)
                    })
                  return (
                    <tr key={r.projectTaskId} className="hover:bg-muted/10">
                      <td className="border-b border-r border-border px-2 py-1.5 align-top text-sm text-foreground">
                        <div className="flex gap-2">
                          <div className="shrink-0 pt-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 border-primary/30 px-2 text-xs"
                              disabled={weekLockedByApproval}
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
                        const k = cellKey(r.projectTaskId, d)
                        const list = entriesByCell.get(k) ?? []
                        const sum = cellHoursSum(list)
                        const first = list[0]
                        const multi = list.length > 1
                        const cellLocked = list.some((x) => x.isLocked)
                        const val =
                          (cellDraft[k] !== undefined
                            ? cellDraft[k]
                            : list.length
                              ? formatDecimalHoursAsClock(sum)
                              : '') ?? ''
                        const showNoteButton =
                          (cellDraft[k] !== undefined ? parseCellHours(String(cellDraft[k]!)) : sum) > 0
                        return (
                          <td key={d} className="border-b border-l border-border p-0 align-middle">
                            <div className="flex min-w-0 items-center gap-0.5 p-0.5">
                              {showNoteButton ? (
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="outline"
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                  disabled={weekLockedByApproval || multi}
                                  onClick={() => {
                                    const entry = list.find((x) => (x.hours || 0) > 0) ?? list[0] ?? null
                                    setWeekCellNoteTarget({ ymd: d, entry })
                                  }}
                                  title={
                                    multi
                                      ? 'This day has multiple entries; use Day view to change each one.'
                                      : first?.isLocked
                                        ? 'This row is approved; edit is blocked'
                                        : 'Note'
                                  }
                                  aria-label="Note"
                                >
                                  <StickyNote className="size-3.5" aria-hidden />
                                </Button>
                              ) : null}
                              <input
                                type="text"
                                inputMode="decimal"
                                className={cn(
                                  'h-8 min-w-0 flex-1 rounded-md border-2 border-border bg-white px-1 py-0.5 text-center text-sm font-semibold tabular-nums text-foreground shadow-sm',
                                  'placeholder:text-muted-foreground/50',
                                  'hover:border-foreground/30',
                                  'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
                                  cellLocked
                                    ? 'cursor-not-allowed border-muted-foreground/25 bg-muted/30 text-muted-foreground'
                                    : 'bg-white',
                                  first?.status === 'APPROVED' &&
                                    'border-emerald-300/80 bg-emerald-50/80 text-emerald-900',
                                  multi && 'border-amber-200/80 bg-amber-50/30',
                                )}
                                disabled={cellLocked || weekLockedByApproval || saveCreate.isPending || multi}
                                value={val}
                                onChange={(ev) => setCellDraft((c) => ({ ...c, [k]: ev.target.value }))}
                                onBlur={(ev) => {
                                  void applyCellBlur(r.projectTaskId, d, ev.target.value.trim())
                                }}
                                title={
                                  multi
                                    ? 'This day has multiple entries; use Day view to change each one.'
                                    : first?.isLocked
                                      ? 'This row is approved; edit is blocked'
                                      : first?.status === 'SUBMITTED'
                                        ? 'Hours in this week’s timesheet (submit/resubmit is once per week, not per line)'
                                        : 'Hours in this week’s timesheet'
                                }
                              />
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-start gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={addRowDisabled}
                onClick={() => setAddRowOpen(true)}
              >
                + Add row
              </Button>
              {showWeekCopyFromRecentDay ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={copyFromRecentProps.onClick}
                    disabled={copyFromRecentProps.disabled || copyFromRecentProps.loading}
                  >
                    {copyFromRecentProps.loading ? 'Copying…' : copyFromRecentProps.label}
                  </Button>
                  {copyFromRecentProps.feedback ? (
                    <p className="max-w-[min(100%,28rem)] text-xs text-muted-foreground">
                      {copyFromRecentProps.feedback}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="ml-auto flex w-full min-w-0 max-w-5xl flex-col items-end gap-2 self-end sm:w-auto">
              {showSubmitWeekForApproval && approvalConfirm !== 'submit' && (
                <div className="flex w-full justify-end sm:w-auto">
                  <Button
                    type="button"
                    className="w-auto shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => setApprovalConfirm('submit')}
                    disabled={doSubmitWeek.isPending}
                  >
                    {submitWeekButtonLabel}
                  </Button>
                </div>
              )}
              {showWithdrawWeekAction && (
                <div className="flex w-full min-w-0 max-w-5xl flex-col items-end gap-2 self-end">
                  {approvalConfirm !== 'withdraw' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-auto shrink-0"
                      onClick={() => setApprovalConfirm('withdraw')}
                      disabled={doWithdrawWeek.isPending}
                    >
                      Withdraw
                    </Button>
                  )}
                  {approvalConfirm === 'withdraw' && (
                    <WithdrawWeekConfirmBanner
                      className="w-full min-w-0"
                      onCancel={() => setApprovalConfirm(null)}
                      onConfirm={() => void doWithdrawWeek.mutateAsync(getWeekOfForApi())}
                      loading={doWithdrawWeek.isPending}
                    />
                  )}
                </div>
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
            weekAllApproved={weekLockedByApproval}
            weekGridEditable={weekGridEditable}
            onAddTime={(d) => {
              if (weekLockedByApproval) {
                return
              }
              setDaySelectedYmd(d)
              setEditing(null)
              setTrackOpen(true)
            }}
            onEditEntry={(e) => {
              if (weekLockedByApproval || e.isLocked) {
                return
              }
              setEditing(e)
              setTrackOpen(true)
            }}
          />
          <div className="flex w-full min-w-0 max-w-5xl flex-col items-end gap-2 self-end sm:w-auto">
            {showSubmitWeekForApproval && approvalConfirm !== 'submit' && (
              <div className="flex w-full justify-end sm:w-auto">
                <Button
                  type="button"
                  className="w-auto shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => setApprovalConfirm('submit')}
                  disabled={doSubmitWeek.isPending}
                >
                  {submitWeekButtonLabel}
                </Button>
              </div>
            )}
            {showWithdrawWeekAction && (
              <div className="flex w-full min-w-0 max-w-5xl flex-col items-end gap-2 self-end">
                {approvalConfirm !== 'withdraw' && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-auto shrink-0"
                    onClick={() => setApprovalConfirm('withdraw')}
                    disabled={doWithdrawWeek.isPending}
                  >
                    Withdraw
                  </Button>
                )}
                {approvalConfirm === 'withdraw' && (
                  <WithdrawWeekConfirmBanner
                    className="w-full min-w-0"
                    onCancel={() => setApprovalConfirm(null)}
                    onConfirm={() => void doWithdrawWeek.mutateAsync(getWeekOfForApi())}
                    loading={doWithdrawWeek.isPending}
                  />
                )}
              </div>
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
        projects={trackTimeOptions?.projects ?? []}
        optionsLoading={trackTimeOptionsLoading}
        editing={editing}
        isSubmitting={saveCreate.isPending || saveUpdate.isPending}
        onSave={onTrackSave}
        onStartTimer={handleStartTimerFromModal}
        onDelete={editing && !editing.isLocked ? onTrackDelete : undefined}
        isDeleting={doDelete.isPending}
      />

      <WeekCellNoteDialog
        open={weekCellNoteTarget != null}
        onClose={() => setWeekCellNoteTarget(null)}
        dateLabel={weekCellNoteTarget ? formatShortWeekdayDate(weekCellNoteTarget.ymd) : ''}
        entry={weekCellNoteTarget?.entry ?? null}
        isSaving={saveUpdate.isPending}
        onSave={async (entryId, notes) => {
          await saveUpdate.mutateAsync({ id: entryId, body: { notes } })
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