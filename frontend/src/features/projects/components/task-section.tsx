import { X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { TaskListItem } from '@/features/tasks/api'
import { cn } from '@/lib/utils'
import { parseTaskDefaultRate, type ProjectFormTask } from '../types'

const inputCls =
  'w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground shadow-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'

type TaskSectionProps = {
  tasks: ProjectFormTask[]
  onChange: (next: ProjectFormTask[]) => void
  /** Time & Materials + Task billable rate */
  showRateColumn: boolean
  currencySymbol?: string
  /** Deduplicated task catalog; dropdown lists tasks not yet on this project. */
  taskAddPool: TaskListItem[]
  catalogLoading?: boolean
}

function taskFromListItem(t: TaskListItem): ProjectFormTask {
  return {
    taskId: t.id,
    name: t.name,
    isBillable: t.isBillable,
    hourlyRate: parseTaskDefaultRate(t.defaultHourlyRate),
  }
}

export function TaskSection({
  tasks,
  onChange,
  showRateColumn,
  currencySymbol = '$',
  taskAddPool,
  catalogLoading = false,
}: TaskSectionProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const suggestId = useId()

  const inProjectIds = useMemo(
    () => new Set(tasks.map((t) => t.taskId)),
    [tasks],
  )

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return taskAddPool.filter(
      (t) =>
        !inProjectIds.has(t.id) &&
        (q === '' || t.name.toLowerCase().includes(q)),
    )
  }, [taskAddPool, inProjectIds, query])

  useEffect(() => {
    if (!open) return
    setHl(0)
  }, [open, available.length, query])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  function pick(t: TaskListItem) {
    onChange([...tasks, taskFromListItem(t)])
    setQuery('')
    setOpen(false)
  }

  function setAllBillable(v: boolean) {
    onChange(tasks.map((row) => ({ ...row, isBillable: v })))
  }

  function updateTask(taskId: string, patch: Partial<ProjectFormTask>) {
    onChange(tasks.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t)))
  }

  function removeTask(taskId: string) {
    onChange(tasks.filter((t) => t.taskId !== taskId))
  }

  return (
    <div className="rounded-md border border-border bg-white">
      {catalogLoading ? (
        <p className="border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
          Loading organization tasks…
        </p>
      ) : null}
      <div
        className={cn(
          'grid gap-2 border-b border-border/80 bg-muted/10 px-2 py-2 text-xs font-semibold text-muted-foreground sm:px-3',
          showRateColumn
            ? 'sm:grid-cols-[2rem_1fr_5.5rem_6.5rem]'
            : 'sm:grid-cols-[2rem_1fr_5.5rem]',
        )}
      >
        <div />
        <div>Tasks</div>
        <div className="text-center sm:text-left">
          <span>Billable</span>
          <button
            type="button"
            onClick={() => {
              const all = tasks.every((t) => t.isBillable)
              setAllBillable(!all)
            }}
            className="ms-1 text-primary hover:underline"
          >
            Select all / None
          </button>
        </div>
        {showRateColumn ? (
          <div className="text-right">
            Billable rate
            <span className="text-[11px] font-normal text-muted-foreground">
              {' '}
              (per hour)
            </span>
          </div>
        ) : null}
      </div>
      <ul>
        {tasks.map((t) => (
          <li
            key={t.taskId}
            className={cn(
              'grid grid-cols-1 items-center gap-2 border-b border-border/60 px-2 py-2.5 sm:px-3',
              showRateColumn
                ? 'sm:grid-cols-[2rem_1fr_5.5rem_6.5rem]'
                : 'sm:grid-cols-[2rem_1fr_5.5rem]',
            )}
          >
            <button
              type="button"
              onClick={() => removeTask(t.taskId)}
              className="inline-flex size-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted/40"
              title="Remove from this project"
            >
              <X className="size-3.5" />
            </button>
            <span className="text-sm font-medium text-foreground">
              {t.name}
            </span>
            <div className="flex justify-center sm:justify-start">
              <input
                type="checkbox"
                className="size-4 rounded border-border text-primary"
                checked={t.isBillable}
                onChange={(e) =>
                  updateTask(t.taskId, { isBillable: e.target.checked })
                }
              />
            </div>
            {showRateColumn ? (
              <div className="flex items-center justify-end gap-0.5">
                <span className="text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={cn(inputCls, 'max-w-[5.5rem]')}
                  value={t.hourlyRate}
                  onChange={(e) =>
                    updateTask(t.taskId, {
                      hourlyRate: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div ref={wrapRef} className="relative px-2 py-2.5 sm:px-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (available.length) {
                setHl((h) => Math.min(h + 1, available.length - 1))
                setOpen(true)
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHl((h) => Math.max(0, h - 1))
            } else if (e.key === 'Enter' && open && available.length) {
              e.preventDefault()
              const t = available[hl] ?? available[0]
              if (t) pick(t)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Add a task…"
          className="h-9 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          autoComplete="off"
          aria-label="Search and add tasks not on this project"
          aria-expanded={open}
          aria-controls={suggestId}
        />
        {open && available.length > 0 ? (
          <div
            id={suggestId}
            className="absolute z-[100] mt-0.5 max-h-48 w-full min-w-0 overflow-y-auto rounded-md border border-border bg-white py-0.5 shadow-lg"
            role="listbox"
          >
            {available.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={i === hl}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm',
                  i === hl
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted/50',
                )}
                onMouseEnter={() => setHl(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(t)
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : null}
        {open && !catalogLoading && query.trim() !== '' && available.length === 0 ? (
          <p className="absolute z-[100] mt-0.5 w-full rounded-md border border-dashed border-border bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
            No matching tasks
          </p>
        ) : null}
        {open && !catalogLoading && query.trim() === '' && taskAddPool.filter((o) => !inProjectIds.has(o.id)).length === 0 ? (
          <p className="absolute z-[100] mt-0.5 w-full rounded-md border border-border bg-white px-2 py-2 text-xs text-muted-foreground shadow-lg">
            All tasks are already on this project
          </p>
        ) : null}
      </div>
    </div>
  )
}
