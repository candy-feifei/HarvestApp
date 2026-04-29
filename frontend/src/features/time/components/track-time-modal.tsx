import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatDecimalHoursAsClock,
  parseClockToDecimal,
} from '@/features/time/time-format'
import type { TimeEntryListItem, TrackTimeProjectOption, TrackTimeTaskOption } from '@/features/time/api'

const primaryBtn =
  'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/30'

type TrackTimeModalProps = {
  open: boolean
  onClose: () => void
  dateLabel: string
  ymd: string
  /** 来自 `GET /time-entries/track-time-options`（projects 联 client 与 project_tasks） */
  projects: TrackTimeProjectOption[]
  optionsLoading: boolean
  editing: TimeEntryListItem | null
  isSubmitting: boolean
  onSave: (payload: {
    projectTaskId: string
    date: string
    hours: number
    notes?: string
  }) => Promise<void>
  onStartTimer?: (payload: {
    projectTaskId: string
    date: string
    notes?: string
    clientName: string
    projectName: string
    taskName: string
  }) => void
  /** 仅编辑已解锁条目时可用 */
  onDelete?: () => Promise<void>
  isDeleting?: boolean
  /**
   * New entry from calendar: enter duration and save only — no “Start timer” / live countdown.
   */
  calendarAddMode?: boolean
}

const selectClassName = cn(
  'h-auto min-h-9 w-full rounded-md border border-border bg-white px-2 py-2 text-sm text-foreground',
  'shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
)

export function TrackTimeModal({
  open,
  onClose,
  dateLabel,
  ymd,
  projects,
  optionsLoading,
  editing,
  isSubmitting,
  onSave,
  onStartTimer,
  onDelete,
  isDeleting = false,
  calendarAddMode = false,
}: TrackTimeModalProps) {
  const isCalendarNew = Boolean(calendarAddMode && !editing)
  const [projectId, setProjectId] = useState('')
  const [projectTaskId, setProjectTaskId] = useState('')
  const [timeStr, setTimeStr] = useState('0:00')
  const [notes, setNotes] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) => a.clientName.localeCompare(b.clientName, 'en') || a.name.localeCompare(b.name, 'en'),
      ),
    [projects],
  )

  const taskOptions: TrackTimeTaskOption[] = useMemo(() => {
    const p = projects.find((x) => x.projectId === projectId)
    if (!p) {
      return []
    }
    return [...p.tasks].sort((a, b) => a.taskName.localeCompare(b.taskName, 'en'))
  }, [projects, projectId])

  const noTasksInProject = Boolean(projectId) && taskOptions.length === 0
  const selectedProject = useMemo(
    () => projects.find((p) => p.projectId === projectId) ?? null,
    [projects, projectId],
  )
  const selectedTask = useMemo(
    () => taskOptions.find((t) => t.projectTaskId === projectTaskId) ?? null,
    [taskOptions, projectTaskId],
  )

  const hoursDecimal = useMemo(() => parseClockToDecimal(timeStr), [timeStr])
  const hasManualHours = hoursDecimal > 0.0001

  useEffect(() => {
    if (!open) {
      return
    }
    setShowDeleteConfirm(false)
    if (editing) {
      for (const p of projects) {
        const t = p.tasks.find((x) => x.projectTaskId === editing.projectTaskId)
        if (t) {
          setProjectId(p.projectId)
          setProjectTaskId(t.projectTaskId)
          setTimeStr(formatDecimalHoursAsClock(editing.hours))
          setNotes(editing.notes ?? '')
          return
        }
      }
      setProjectId('')
      setProjectTaskId(editing.projectTaskId)
      setTimeStr(formatDecimalHoursAsClock(editing.hours))
      setNotes(editing.notes ?? '')
    } else {
      setTimeStr(calendarAddMode ? '' : '0:00')
      setNotes('')
    }
  }, [open, editing, projects, calendarAddMode])

  useEffect(() => {
    if (!open || editing) {
      return
    }
    if (projects.length === 0) {
      setProjectId('')
      setProjectTaskId('')
      return
    }
    setProjectId((pid) => (pid && projects.some((p) => p.projectId === pid) ? pid : projects[0]!.projectId))
  }, [open, editing, projects])

  useEffect(() => {
    if (!open || editing) {
      return
    }
    if (!projectId) {
      setProjectTaskId('')
      return
    }
    const p = projects.find((x) => x.projectId === projectId)
    if (!p || p.tasks.length === 0) {
      setProjectTaskId('')
      return
    }
    setProjectTaskId((cur) => {
      if (cur && p.tasks.some((t) => t.projectTaskId === cur)) {
        return cur
      }
      return p.tasks[0]!.projectTaskId
    })
  }, [open, editing, projectId, projects])

  const onProjectChange = useCallback(
    (nextId: string) => {
      if (editing) {
        return
      }
      setProjectId(nextId)
      const p = projects.find((x) => x.projectId === nextId)
      setProjectTaskId(p?.tasks[0]?.projectTaskId ?? '')
    },
    [editing, projects],
  )

  if (!open) {
    return null
  }

  const handleSave = async () => {
    const h = parseClockToDecimal(timeStr)
    if (!projectTaskId) {
      return
    }
    if (isCalendarNew) {
      if (h <= 0) {
        return
      }
    } else if (!editing && h <= 0) {
      return
    }
    await onSave({ projectTaskId, date: ymd, hours: h, notes: notes.trim() || undefined })
    setTimeStr(formatDecimalHoursAsClock(h))
  }

  const handleStartTimer = () => {
    if (!onStartTimer || !projectTaskId || !selectedProject || !selectedTask) {
      return
    }
    onStartTimer({
      projectTaskId,
      date: ymd,
      notes: notes.trim() || undefined,
      clientName: selectedProject.clientName,
      projectName: selectedProject.name,
      taskName: selectedTask.taskName,
    })
  }

  const disabledInputs = optionsLoading || projects.length === 0
  const projectDisabled = Boolean(editing) || disabledInputs
  const taskDisabled = Boolean(editing) || disabledInputs || !projectId || taskOptions.length === 0
  const canPickTask = Boolean(projectTaskId && selectedTask) && !disabledInputs
  const canSaveNewWithHours = !editing && hasManualHours && canPickTask
  const canUpdate = Boolean(editing) && canPickTask
  const canShowDelete = Boolean(editing && onDelete && !editing.isLocked)
  const busy = isSubmitting || isDeleting

  const handleConfirmDelete = async () => {
    if (!onDelete) {
      return
    }
    await onDelete()
    setShowDeleteConfirm(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-time-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="track-time-title" className="text-base font-semibold text-foreground">
            {editing ? `Edit time entry · ${dateLabel}` : `New time entry for ${dateLabel}`}
          </h2>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="track-project"
            >
              Project
            </label>
            <select
              id="track-project"
              className={selectClassName}
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              disabled={projectDisabled}
            >
              {optionsLoading ? (
                <option value="">Loading…</option>
              ) : sortedProjects.length === 0 ? (
                <option value="">— No projects —</option>
              ) : (
                sortedProjects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.clientName} — {p.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="track-task">
              Task
            </label>
            <select
              id="track-task"
              className={selectClassName}
              value={noTasksInProject || !projectId ? '' : projectTaskId}
              onChange={(e) => setProjectTaskId(e.target.value)}
              disabled={taskDisabled}
            >
              {optionsLoading ? (
                <option value="">Loading…</option>
              ) : !projectId ? (
                <option value="">Select a project first</option>
              ) : noTasksInProject ? (
                <option value="">— No tasks in this project —</option>
              ) : (
                taskOptions.map((t) => (
                  <option key={t.projectTaskId} value={t.projectTaskId}>
                    {t.taskName}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground shadow-sm"
                rows={4}
                placeholder=""
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex w-full shrink-0 flex-col items-stretch sm:w-28 sm:items-center">
              <label
                className="mb-1.5 w-full text-left text-sm font-medium text-foreground sm:text-center"
                htmlFor="time"
              >
                Time
              </label>
              <input
                id="time"
                className="w-full rounded-md border-2 border-border bg-white py-2 text-center text-3xl font-medium tabular-nums tracking-tight text-foreground shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none sm:max-w-[7rem]"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                onBlur={() => {
                  if (isCalendarNew && timeStr.trim() === '') {
                    return
                  }
                  setTimeStr((s) => formatDecimalHoursAsClock(parseClockToDecimal(s)))
                }}
                inputMode="text"
                autoComplete="off"
                placeholder="0:00"
              />
            </div>
          </div>
        </div>
        {showDeleteConfirm && canShowDelete ? (
          <div className="flex w-full min-w-0 flex-col gap-3 border-t border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3">
            <p className="min-w-0 flex-1 break-words text-sm text-foreground sm:pr-2">
              Permanently delete this time entry?
            </p>
            <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                className="shrink-0 bg-destructive text-white hover:bg-destructive/90"
                disabled={busy}
                onClick={() => void handleConfirmDelete()}
              >
                Delete time entry
              </Button>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-border bg-white"
                disabled={busy}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-3 sm:px-4">
            <div className="min-w-0">
              {canShowDelete ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto shrink-0 px-0 text-destructive hover:text-destructive/90"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              {editing ? (
                <Button
                  type="button"
                  className={primaryBtn}
                  onClick={handleSave}
                  disabled={busy || !canUpdate}
                >
                  Update entry
                </Button>
              ) : isCalendarNew ? (
                <Button
                  type="button"
                  className={primaryBtn}
                  onClick={handleSave}
                  disabled={busy || !canPickTask || !hasManualHours}
                >
                  Save entry
                </Button>
              ) : canSaveNewWithHours ? (
                <Button
                  type="button"
                  className={primaryBtn}
                  onClick={handleSave}
                  disabled={busy || !canPickTask}
                >
                  Save entry
                </Button>
              ) : onStartTimer ? (
                <Button
                  type="button"
                  className={primaryBtn}
                  onClick={handleStartTimer}
                  disabled={busy || !canPickTask}
                >
                  Start timer
                </Button>
              ) : (
                <Button type="button" className={primaryBtn} disabled>
                  Save entry
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
