import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveTask,
  batchArchiveTasks,
  createTask,
  deleteTask,
  downloadTasksExport,
  listTasks,
  type TaskListItem,
  updateTask,
} from '@/features/tasks/api'
import { fetchOrganizationContext } from '@/features/clients/api'
import { ApiError } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, Plus, Search } from 'lucide-react'

const inputCls =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'

function formatTaskRate(
  amount: string | null,
  currency: string,
): { label: string; className: string } {
  if (amount == null) {
    return { label: '—', className: 'text-muted-foreground' }
  }
  const n = Number(amount)
  if (Number.isNaN(n)) {
    return { label: '—', className: 'text-muted-foreground' }
  }
  return {
    label: new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(n),
    className: 'text-foreground tabular-nums',
  }
}

type TaskSectionId = 'common' | 'other'

function useOutsideClick(
  open: boolean,
  onClose: () => void,
  ref: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) {
      return
    }
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose, ref])
}

function TaskRow({
  task,
  section,
  orgCurrency,
  selected,
  onToggleSelect,
  onEdit,
  onAfterMutation,
  openId,
  setOpenId,
}: {
  task: TaskListItem
  section: TaskSectionId
  orgCurrency: string
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (t: TaskListItem) => void
  onAfterMutation: () => void
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const open = openId === task.id
  const ref = useRef<HTMLDivElement | null>(null)
  useOutsideClick(open, () => setOpenId(null), ref)

  const rate = formatTaskRate(task.defaultHourlyRate, orgCurrency)

  async function run(op: 'archive' | 'delete' | 'move' | 'addAll') {
    setErr(null)
    setBusy(true)
    try {
      if (op === 'archive') {
        await archiveTask(task.id)
      } else if (op === 'delete') {
        const ok = window.confirm(
          'Delete this task? If it has time entries, archive it instead.',
        )
        if (!ok) {
          setBusy(false)
          return
        }
        await deleteTask(task.id)
      } else if (op === 'addAll') {
        const ok = window.confirm(
          'Add this task to all existing projects in the organization?',
        )
        if (!ok) {
          setBusy(false)
          return
        }
        await updateTask(task.id, { addToAllExistingProjects: true })
      } else {
        const next = !task.isCommon
        await updateTask(task.id, { isCommon: next })
      }
      setOpenId(null)
      onAfterMutation()
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.message)
        return
      }
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      {err ? (
        <p className="mb-1 text-xs text-destructive" role="alert">
          {err}
        </p>
      ) : null}
      <div
        className={cn(
          'grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 border-b border-border/80 px-2 py-2.5 sm:grid-cols-[2rem_1fr_8rem_7rem] sm:px-3',
          'hover:bg-muted/15',
        )}
      >
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(task.id)}
            className="size-4 rounded border-border text-primary"
            title="Select row"
            aria-label={`Select ${task.name}`}
          />
        </label>
        <div className="min-w-0 flex flex-nowrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            {task.name}
          </span>
          {task.isBillable ? (
            <span className="inline-flex shrink-0 rounded border border-border bg-white px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Billable
            </span>
          ) : null}
        </div>
        <div className={cn('text-right text-sm', rate.className)}>
          {rate.label}
        </div>
        <div className="relative flex justify-end" ref={ref}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-w-[7rem] gap-1 border-border text-[13px] font-normal"
            disabled={busy}
            onClick={() => setOpenId(open ? null : task.id)}
            aria-haspopup
            aria-expanded={open}
          >
            Actions
            <ChevronDown
              className={cn('size-3.5 transition', open && 'rotate-180')}
            />
          </Button>
          {open ? (
            <div
              className="absolute right-0 top-full z-[100] mt-0.5 min-w-[10rem] rounded-md border border-border bg-white py-0.5 shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                onClick={() => {
                  setOpenId(null)
                  onEdit(task)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                onClick={() => void run('addAll')}
              >
                Add to all projects
              </button>
              {section === 'common' ? (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                  onClick={() => void run('move')}
                >
                  Move to Other tasks
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                  onClick={() => void run('move')}
                >
                  Move to Common tasks
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                onClick={() => void run('archive')}
              >
                Archive
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/5"
                onClick={() => void run('delete')}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function TaskBlock({
  id,
  title,
  description,
  tasks,
  orgCurrency,
  allSelected,
  onSelectAll,
  someSelected,
  selectedIds,
  toggle,
  onEdit,
  onInvalidate,
  openId,
  setOpenId,
}: {
  id: TaskSectionId
  title: string
  description: string
  tasks: TaskListItem[]
  orgCurrency: string
  allSelected: boolean
  onSelectAll: (checked: boolean) => void
  someSelected: boolean
  selectedIds: Set<string>
  toggle: (taskId: string) => void
  onEdit: (t: TaskListItem) => void
  onInvalidate: () => void
  openId: string | null
  setOpenId: (s: string | null) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
          No tasks in this section
        </div>
      ) : (
        <div className="overflow-visible rounded-md border border-border bg-white shadow-sm">
          <div
            className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2 border-b border-border bg-muted/20 px-2 py-1.5 text-sm text-muted-foreground sm:grid-cols-[2rem_1fr_8rem_7rem] sm:px-3"
            role="row"
          >
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="size-4 rounded border-border text-primary"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = !allSelected && someSelected
                  }
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                title={
                  id === 'common'
                    ? 'Select all common tasks on this page'
                    : 'Select all other tasks on this page'
                }
              />
            </div>
            <div />
            <div className="pr-0 text-right text-sm font-medium text-foreground/90 sm:pr-1">
              Default billable rate
            </div>
            <div />
          </div>
          <ul className="divide-y divide-border/0">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                section={id}
                orgCurrency={orgCurrency}
                selected={selectedIds.has(t.id)}
                onToggleSelect={toggle}
                onEdit={onEdit}
                onAfterMutation={onInvalidate}
                openId={openId}
                setOpenId={setOpenId}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function TasksPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const q = useDeferredValue(filter)
  const [orgCurrency, setOrgCurrency] = useState('USD')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const [isCommon, setIsCommon] = useState(false)
  const [addToAll, setAddToAll] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)
  useOutsideClick(exportOpen, () => setExportOpen(false), exportRef)

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['tasks', q],
    queryFn: () => listTasks(q),
  })

  useEffect(() => {
    let c = true
    fetchOrganizationContext()
      .then((ctx) => {
        if (c) {
          setOrgCurrency(ctx.organization.defaultCurrency || 'USD')
        }
      })
      .catch(() => {
        if (c) {
          setOrgCurrency('USD')
        }
      })
    return () => {
      c = false
    }
  }, [])

  const createMut = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      resetForm()
    },
  })
  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Parameters<typeof updateTask>[1]
    }) => updateTask(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      resetForm()
    },
  })

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not load tasks.'
        : null

  const common = data?.common ?? []
  const other = data?.other ?? []

  const allIds = useMemo(
    () => [...common.map((t) => t.id), ...other.map((t) => t.id)],
    [common, other],
  )
  const selectedInView = useMemo(
    () => allIds.filter((id) => selectedIds.has(id)),
    [allIds, selectedIds],
  )

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setName('')
    setRate('')
    setIsBillable(true)
    setIsCommon(false)
    setAddToAll(false)
    setFormError(null)
  }

  function startNew() {
    setEditingId(null)
    setName('')
    setRate('')
    setIsBillable(true)
    setIsCommon(false)
    setAddToAll(false)
    setFormError(null)
    setFormOpen(true)
  }

  function startEdit(t: TaskListItem) {
    setEditingId(t.id)
    setName(t.name)
    setRate(
      t.defaultHourlyRate != null ? String(Number(t.defaultHourlyRate)) : '',
    )
    setIsBillable(t.isBillable)
    setIsCommon(t.isCommon)
    setAddToAll(false)
    setFormError(null)
    setFormOpen(true)
    setActionMenuId(null)
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }
      return n
    })
  }

  function selectAllIn(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (checked) {
        for (const i of ids) {
          n.add(i)
        }
      } else {
        for (const i of ids) {
          n.delete(i)
        }
      }
      return n
    })
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const tname = name.trim()
    if (!tname) {
      setFormError('Please enter a task name.')
      return
    }
    let defaultHourlyRate: number | undefined
    if (rate.trim() !== '') {
      const n = Number(rate)
      if (Number.isNaN(n) || n < 0) {
        setFormError('Default rate is not a valid number.')
        return
      }
      defaultHourlyRate = n
    }
    if (editingId) {
      const currentRow = [...common, ...other].find((t) => t.id === editingId)
      if (!currentRow) {
        setFormError('Task is no longer in the list. Please try again.')
        return
      }
      let payloadDefaultRate: number | null | undefined
      if (rate.trim() === '') {
        if (currentRow.defaultHourlyRate == null) {
          payloadDefaultRate = undefined
        } else {
          payloadDefaultRate = null
        }
      } else {
        payloadDefaultRate = defaultHourlyRate!
      }
      updateMut.mutate(
        {
          id: editingId,
          body: {
            name: tname,
            isCommon,
            isBillable,
            ...(payloadDefaultRate === undefined
              ? {}
              : { defaultHourlyRate: payloadDefaultRate }),
            addToAllExistingProjects: addToAll,
          },
        },
        {
          onError: (x) => {
            if (x instanceof ApiError) {
              setFormError(x.message)
            } else {
              setFormError('Could not save changes.')
            }
          },
        },
      )
      return
    }
    createMut.mutate(
      {
        name: tname,
        isCommon,
        isBillable,
        defaultHourlyRate: defaultHourlyRate,
        addToAllExistingProjects: addToAll,
      },
      {
        onError: (x) => {
          if (x instanceof ApiError) {
            setFormError(x.message)
          } else {
            setFormError('Could not create task.')
          }
        },
      },
    )
  }

  const bulkArchiving = useMutation({
    mutationFn: (ids: string[]) => batchArchiveTasks(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelectedIds(new Set())
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tasks
        </h1>
        <div className="flex flex-col gap-2 self-stretch sm:max-w-none sm:flex-row sm:items-center sm:gap-2">
          <Button
            type="button"
            className="h-9 w-full gap-2 sm:w-auto"
            onClick={startNew}
          >
            <Plus className="size-4" aria-hidden />
            New task
          </Button>
          <div className="relative self-end sm:self-auto" ref={exportRef}>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full min-w-0 gap-1.5 sm:w-auto"
              onClick={() => setExportOpen((v) => !v)}
            >
              Export
              <ChevronDown
                className="size-4"
                strokeWidth={2}
                aria-hidden
              />
            </Button>
            {exportOpen ? (
              <div
                className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-border bg-white py-0.5 shadow-md"
                role="menu"
              >
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                  onClick={async () => {
                    setExportOpen(false)
                    try {
                      await downloadTasksExport(q, 'csv')
                    } catch (e) {
                      if (e instanceof ApiError) {
                        // eslint-disable-next-line no-alert
                        alert(e.message)
                      }
                    }
                  }}
                >
                  Export as CSV
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                  onClick={async () => {
                    setExportOpen(false)
                    try {
                      await downloadTasksExport(q, 'json')
                    } catch (e) {
                      if (e instanceof ApiError) {
                        // eslint-disable-next-line no-alert
                        alert(e.message)
                      }
                    }
                  }}
                >
                  Export as JSON
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by task name"
          className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none"
          autoComplete="off"
          name="task-filter"
        />
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={onSave}
          className="space-y-4 rounded-md border border-primary/30 bg-primary/[0.06] p-4"
        >
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="task-name"
            >
              Task name
            </label>
            <input
              id="task-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="task-rate"
            >
              Default billable rate
            </label>
            <div className="flex max-w-sm flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-2">
              <div className="flex flex-1 items-baseline gap-1">
                <span
                  className="text-sm text-muted-foreground"
                  aria-hidden
                >
                  $
                </span>
                <input
                  id="task-rate"
                  type="text"
                  inputMode="decimal"
                  className={cn(inputCls, 'flex-1 sm:max-w-[8rem]')}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  per hour
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A default rate helps keep reports accurate.
            </p>
          </div>
          <div className="space-y-2.5 text-sm text-foreground">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border text-primary"
                checked={isBillable}
                onChange={(e) => setIsBillable(e.target.checked)}
              />
              <span>This task is billable by default</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border text-primary"
                checked={isCommon}
                onChange={(e) => setIsCommon(e.target.checked)}
              />
              <span>
                This is a common task and will be added to new projects
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border text-primary"
                checked={addToAll}
                onChange={(e) => setAddToAll(e.target.checked)}
              />
              <span>Add this task to all existing projects</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="h-9"
              disabled={createMut.isPending || updateMut.isPending}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {isFetching && !isLoading ? (
        <p className="text-xs text-muted-foreground">Updating…</p>
      ) : null}

      {selectedInView.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm text-foreground">
          <span>{selectedInView.length} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  !window.confirm(
                    `Archive the ${selectedInView.length} selected task(s)?`,
                  )
                ) {
                  return
                }
                bulkArchiving.mutate(selectedInView, {
                  onError: (e) => {
                    if (e instanceof ApiError) {
                      // eslint-disable-next-line no-alert
                      alert(e.message)
                    }
                  },
                })
              }}
              disabled={bulkArchiving.isPending}
            >
              Archive selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}

      {!errorMessage && !isLoading && common.length === 0 && other.length === 0
        ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
              No tasks yet. Create one with &quot;New task&quot; or change the filter.
            </div>
          )
        : null}

      <div className="space-y-8">
        <TaskBlock
          id="common"
          title="Common tasks"
          description="These tasks are added automatically when you create a new project."
          tasks={common}
          orgCurrency={orgCurrency}
          allSelected={common.length > 0 && common.every((t) => selectedIds.has(t.id))}
          someSelected={common.some((t) => selectedIds.has(t.id))}
          onSelectAll={(c) => selectAllIn(
            common.map((t) => t.id),
            c,
          )}
          selectedIds={selectedIds}
          toggle={toggle}
          onEdit={startEdit}
          onInvalidate={() => {
            void queryClient.invalidateQueries({ queryKey: ['tasks'] })
            setActionMenuId(null)
          }}
          openId={actionMenuId}
          setOpenId={setActionMenuId}
        />
        <TaskBlock
          id="other"
          title="Other tasks"
          description="These tasks must be added to projects manually."
          tasks={other}
          orgCurrency={orgCurrency}
          allSelected={other.length > 0 && other.every((t) => selectedIds.has(t.id))}
          someSelected={other.some((t) => selectedIds.has(t.id))}
          onSelectAll={(c) => selectAllIn(
            other.map((t) => t.id),
            c,
          )}
          selectedIds={selectedIds}
          toggle={toggle}
          onEdit={startEdit}
          onInvalidate={() => {
            void queryClient.invalidateQueries({ queryKey: ['tasks'] })
            setActionMenuId(null)
          }}
          openId={actionMenuId}
          setOpenId={setActionMenuId}
        />
      </div>
    </div>
  )
}
