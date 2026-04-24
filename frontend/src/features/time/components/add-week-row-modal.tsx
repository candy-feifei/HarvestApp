import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Popover } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AssignableRow } from '@/features/time/api'

type ProjectOption = {
  projectId: string
  projectName: string
  clientId: string
  clientName: string
}

type TaskOption = {
  taskId: string
  taskName: string
  projectTaskId: string
}

type AddWeekRowModalProps = {
  open: boolean
  onClose: () => void
  assignable: AssignableRow[]
  usedProjectTaskIds: Set<string>
  onAdd: (projectTaskId: string) => void
}

function uniqueProjects(rows: AssignableRow[]): ProjectOption[] {
  const m = new Map<string, ProjectOption>()
  for (const r of rows) {
    if (!m.has(r.projectId)) {
      m.set(r.projectId, {
        projectId: r.projectId,
        projectName: r.projectName,
        clientId: r.clientId,
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
  const [taskId, setTaskId] = useState('')
  const [projectOpen, setProjectOpen] = useState(false)

  /** Rows not already on this week; empty set still shows Project/Task fields. */
  const available = useMemo(
    () => assignable.filter((r) => !usedProjectTaskIds.has(r.projectTaskId)),
    [assignable, usedProjectTaskIds],
  )

  const projectOptions = useMemo(() => uniqueProjects(available), [available])
  const taskOptions = useMemo(() => uniqueTasksForProject(available, projectId), [available, projectId])

  const selectedProject = useMemo(
    () => projectOptions.find((p) => p.projectId === projectId),
    [projectOptions, projectId],
  )

  const selectedProjectTaskId = useMemo(() => {
    if (!projectId || !taskId) {
      return ''
    }
    return available.find((r) => r.projectId === projectId && r.taskId === taskId)?.projectTaskId ?? ''
  }, [available, projectId, taskId])

  useEffect(() => {
    if (!open) {
      return
    }
    setProjectId('')
    setTaskId('')
    setProjectOpen(false)
  }, [open])

  if (!open) {
    return null
  }

  const handleAdd = () => {
    if (!selectedProjectTaskId) {
      return
    }
    onAdd(selectedProjectTaskId)
    onClose()
  }

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
            <div className="mb-1.5 text-sm font-medium text-foreground">Project / Task</div>
            <Popover.Root open={projectOpen} onOpenChange={setProjectOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex h-auto min-h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-left text-sm',
                    'shadow-sm transition-colors hover:bg-muted/30 focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
                  )}
                  aria-label="Select project"
                  id="awr-project"
                >
                  {selectedProject ? (
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">{selectedProject.clientName}</span>
                      <span className="block font-semibold text-foreground">{selectedProject.projectName}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select a project</span>
                  )}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 w-[min(100vw-2rem,24rem)] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
                  sideOffset={4}
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <ul className="max-h-60 min-h-0 overflow-y-auto py-0.5">
                    {projectOptions.map((p) => {
                      const isSel = p.projectId === projectId
                      return (
                        <li key={p.projectId}>
                          <button
                            type="button"
                            onClick={() => {
                              setProjectId(p.projectId)
                              setTaskId('')
                              setProjectOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left text-sm',
                              isSel ? 'bg-primary/10' : 'hover:bg-muted/60',
                            )}
                          >
                            {isSel ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : (
                              <span className="w-3.5 shrink-0" />
                            )}
                            <span>
                              <span className="block text-xs text-muted-foreground">{p.clientName}</span>
                              <span className="block font-semibold text-foreground">{p.projectName}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="awr-task">
              Task
            </label>
            <select
              id="awr-task"
              className={cn(
                'h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground',
                'shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
                !projectId && 'cursor-not-allowed opacity-60',
              )}
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={!projectId}
            >
              <option value="">
                {!projectId ? '— Select a project first —' : '— Select a task —'}
              </option>
              {taskOptions.map((t) => (
                <option key={t.taskId} value={t.taskId}>
                  {t.taskName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleAdd}
            disabled={!selectedProjectTaskId}
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
