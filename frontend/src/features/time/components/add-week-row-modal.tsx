import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AssignableRow } from '@/features/time/api'

type AddWeekRowModalProps = {
  open: boolean
  onClose: () => void
  assignable: AssignableRow[]
  usedProjectTaskIds: Set<string>
  onAdd: (projectTaskId: string) => void
}

type ProjectOption = {
  projectId: string
  projectName: string
  clientName: string
}

type TaskOption = {
  taskId: string
  taskName: string
  projectTaskId: string
}

const selectClassName = cn(
  'h-auto min-h-9 w-full rounded-md border border-border bg-white px-2 py-2 text-sm text-foreground',
  'shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
)

function uniqueProjects(rows: AssignableRow[]): ProjectOption[] {
  const m = new Map<string, ProjectOption>()
  for (const r of rows) {
    if (!m.has(r.projectId)) {
      m.set(r.projectId, {
        projectId: r.projectId,
        projectName: r.projectName,
        clientName: r.clientName,
      })
    }
  }
  return [...m.values()].sort(
    (a, b) =>
      a.clientName.localeCompare(b.clientName, 'en') || a.projectName.localeCompare(b.projectName, 'en'),
  )
}

function uniqueTasksForProject(rows: AssignableRow[], projectId: string): TaskOption[] {
  const m = new Map<string, TaskOption>()
  for (const r of rows) {
    if (r.projectId !== projectId) {
      continue
    }
    if (!m.has(r.taskId)) {
      m.set(r.taskId, { taskId: r.taskId, taskName: r.taskName, projectTaskId: r.projectTaskId })
    }
  }
  return [...m.values()].sort((a, b) => a.taskName.localeCompare(b.taskName, 'en'))
}

export function AddWeekRowModal({
  open,
  onClose,
  assignable,
  usedProjectTaskIds,
  onAdd,
}: AddWeekRowModalProps) {
  const [projectId, setProjectId] = useState('')
  const [projectTaskId, setProjectTaskId] = useState('')

  /** Rows not already on this week. */
  const available = useMemo(
    () => assignable.filter((r) => !usedProjectTaskIds.has(r.projectTaskId)),
    [assignable, usedProjectTaskIds],
  )

  const projectOptions = useMemo(() => uniqueProjects(available), [available])
  const taskOptions = useMemo(
    () => (projectId ? uniqueTasksForProject(available, projectId) : []),
    [available, projectId],
  )

  const syncSelectionToAvailable = useCallback(() => {
    if (projectOptions.length === 0) {
      setProjectId('')
      setProjectTaskId('')
      return
    }
    setProjectId((p) => {
      const next =
        p && projectOptions.some((x) => x.projectId === p) ? p : (projectOptions[0]?.projectId ?? '')
      return next
    })
  }, [projectOptions])

  useEffect(() => {
    if (!open) {
      return
    }
    syncSelectionToAvailable()
  }, [open, available, syncSelectionToAvailable])

  useEffect(() => {
    if (!open) {
      return
    }
    if (!projectId) {
      setProjectTaskId('')
      return
    }
    const tasks = uniqueTasksForProject(available, projectId)
    setProjectTaskId((t) => {
      if (t && tasks.some((x) => x.projectTaskId === t)) {
        return t
      }
      return tasks[0]?.projectTaskId ?? ''
    })
  }, [open, projectId, available])

  const onProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId)
    const tasks = uniqueTasksForProject(available, nextProjectId)
    setProjectTaskId(tasks[0]?.projectTaskId ?? '')
  }

  if (!open) {
    return null
  }

  const handleAdd = () => {
    if (!projectTaskId) {
      return
    }
    onAdd(projectTaskId)
    onClose()
  }

  const noProjects = projectOptions.length === 0
  const noTasksInProject = Boolean(projectId) && taskOptions.length === 0
  const canSave = Boolean(projectTaskId) && !noProjects && !noTasksInProject

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-week-row-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="add-week-row-title" className="text-base font-semibold text-foreground">
            Add row to this timesheet
          </h2>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="add-week-project"
            >
              Project
            </label>
            <select
              id="add-week-project"
              className={selectClassName}
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              disabled={noProjects}
            >
              {noProjects ? (
                <option value="">— No projects —</option>
              ) : (
                projectOptions.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.clientName} — {p.projectName}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="add-week-task"
            >
              Task
            </label>
            <select
              id="add-week-task"
              className={selectClassName}
              value={noTasksInProject || !projectId ? '' : projectTaskId}
              onChange={(e) => setProjectTaskId(e.target.value)}
              disabled={!projectId || taskOptions.length === 0}
            >
              {!projectId ? (
                <option value="">Select a project first</option>
              ) : noTasksInProject ? (
                <option value="">— No tasks available for this project —</option>
              ) : (
                taskOptions.map((t) => (
                  <option key={t.projectTaskId} value={t.projectTaskId}>
                    {t.taskName}
                  </option>
                ))
              )}
            </select>
            {noProjects ? (
              <p className="mt-2 text-xs text-muted-foreground">
                All assignable project–task lines are already on this week, or you have no assignments.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleAdd}
            disabled={!canSave}
          >
            Save row
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
