import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { fetchOrganizationContext } from '@/features/clients/api'
import { ApiError } from '@/lib/api/http'
import { cn } from '@/lib/utils'
import { ChevronDown, Search } from 'lucide-react'
import {
  createProject,
  deleteProject,
  formValuesToCreatePayload,
  getProject,
  getProjects,
  updateProject,
} from '../api'
import {
  projectListBudgetValue,
  projectListSpentValue,
  projectRemaining,
  projectRemainingPercentOfBudget,
  projectTypeLabelFromApi,
  projectFormValuesFromRecord,
  type ProjectRecord,
} from '../types'

const qk = { projects: ['projects'] as const }

const ACTION_MENU_MIN_W = 9 * 16
/** Light apricot row highlight, similar to Harvest multi-select. */
const selectedRowClass = 'bg-[#fff4e5] hover:bg-[#ffecdb]'
const BULK_MENU_MIN_W = 12 * 16

function useOutsideClickMenu(
  open: boolean,
  onClose: () => void,
  buttonRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) {
        return
      }
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose, buttonRef, menuRef])
}

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(n)
}

type StatusFilter = 'active' | 'archived' | 'all'

type RowMenuProps = {
  p: ProjectRecord
  onRefresh: () => Promise<void>
}

function ProjectRowMenu({ p, onRefresh }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const buttonWrapRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const updateMenuPosition = useCallback(() => {
    const el = buttonWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const rawLeft = r.right - ACTION_MENU_MIN_W
    const maxLeft = Math.max(margin, globalThis.innerWidth - ACTION_MENU_MIN_W - margin)
    setMenuPos({
      top: r.bottom + 4,
      left: Math.min(Math.max(margin, rawLeft), maxLeft),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, p.id, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onReposition() {
      updateMenuPosition()
    }
    window.addEventListener('resize', onReposition)
    document.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      document.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updateMenuPosition])

  useOutsideClickMenu(open, () => setOpen(false), buttonWrapRef, menuRef)

  async function run(op: 'pin' | 'dup' | 'arch' | 'del') {
    setErr(null)
    setBusy(true)
    try {
      if (op === 'pin') {
        await updateProject(p.id, { isPinned: !p.isPinned })
      } else if (op === 'dup') {
        const full = await getProject(p.id)
        const f = projectFormValuesFromRecord(full)
        f.name = `${f.name} (copy)`
        await createProject(formValuesToCreatePayload(f))
      } else if (op === 'arch') {
        await updateProject(p.id, { isArchived: true })
      } else {
        const ok = window.confirm('Delete this project? This may fail if linked time entries exist.')
        if (!ok) {
          setBusy(false)
          return
        }
        await deleteProject(p.id)
      }
      setOpen(false)
      await qc.invalidateQueries({ queryKey: qk.projects })
      await onRefresh()
    } catch (e) {
      if (e instanceof ApiError) setErr(e.message)
      else setErr('Action failed')
    } finally {
      setBusy(false)
    }
  }

  const menu =
    open && typeof document !== 'undefined' ? (
      createPortal(
        <div
          ref={menuRef}
          className="fixed z-[200] min-w-[9rem] rounded-md border border-border bg-white py-0.5 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => {
              setOpen(false)
              navigate(`/projects/${p.id}/edit`)
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => void run('pin')}
          >
            {p.isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => void run('dup')}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => void run('arch')}
            disabled={p.isArchived}
          >
            Archive
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted/40"
            onClick={() => void run('del')}
          >
            Delete
          </button>
        </div>,
        document.body,
      )
    ) : null

  return (
    <div className="flex flex-col items-end">
      {err ? (
        <p
          className="mb-0.5 max-w-[12rem] text-right text-xs text-destructive"
          role="alert"
        >
          {err}
        </p>
      ) : null}
      <div ref={buttonWrapRef} className="inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-[6.5rem] gap-1 border-border text-[13px] font-normal"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup
          aria-expanded={open}
        >
          Actions
          <ChevronDown
            className={cn('size-3.5 transition', open && 'rotate-180')}
          />
        </Button>
      </div>
      {menu}
    </div>
  )
}

type BulkProjectsToolbarProps = {
  count: number
  selectedIds: string[]
  onClearSelection: () => void
  onRefresh: () => Promise<void>
}

/**
 * Shown beside filters when rows are selected (bulk archive / delete; portal avoids clipping).
 */
function BulkProjectsToolbar({
  count,
  selectedIds,
  onClearSelection,
  onRefresh,
}: BulkProjectsToolbarProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const buttonWrapRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const qc = useQueryClient()

  const updateMenuPosition = useCallback(() => {
    const el = buttonWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const rawLeft = r.left
    const maxLeft = Math.max(
      margin,
      globalThis.innerWidth - BULK_MENU_MIN_W - margin,
    )
    setMenuPos({
      top: r.bottom + 4,
      left: Math.min(Math.max(margin, rawLeft), maxLeft),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onReposition() {
      updateMenuPosition()
    }
    window.addEventListener('resize', onReposition)
    document.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      document.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updateMenuPosition])

  useOutsideClickMenu(open, () => setOpen(false), buttonWrapRef, menuRef)

  async function bulkArchive() {
    setErr(null)
    setBusy(true)
    try {
      await Promise.all(
        selectedIds.map((id) => updateProject(id, { isArchived: true })),
      )
      setOpen(false)
      await qc.invalidateQueries({ queryKey: qk.projects })
      await onRefresh()
      onClearSelection()
    } catch (e) {
      if (e instanceof ApiError) setErr(e.message)
      else setErr('Bulk archive failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function bulkDelete() {
    const ok = window.confirm(
      `Delete ${count} selected project(s)? This may fail if a project has linked time entries.`,
    )
    if (!ok) return
    setErr(null)
    setBusy(true)
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => deleteProject(id)),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      await qc.invalidateQueries({ queryKey: qk.projects })
      await onRefresh()
      if (failed > 0) {
        setErr(
          `${failed} project(s) could not be deleted. Others may have been removed.`,
        )
      } else {
        setOpen(false)
        onClearSelection()
      }
    } finally {
      setBusy(false)
    }
  }

  const menu =
    open && typeof document !== 'undefined' ? (
      createPortal(
        <div
          ref={menuRef}
          className="fixed z-[200] min-w-[12rem] rounded-md border border-border bg-white py-0.5 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            disabled={busy}
            onClick={() => void bulkArchive()}
          >
            Archive selected projects
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-neutral-900 hover:text-white"
            disabled={busy}
            onClick={() => void bulkDelete()}
          >
            Delete selected projects
          </button>
        </div>,
        document.body,
      )
    ) : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={buttonWrapRef} className="inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-w-[6.5rem] gap-1 border-border text-[13px] font-normal"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup
          aria-expanded={open}
        >
          Actions
          <ChevronDown
            className={cn('size-3.5 transition', open && 'rotate-180')}
          />
        </Button>
      </div>
      {menu}
      {err ? (
        <p className="text-xs text-destructive" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  )
}

function ProgressCell({ p }: { p: ProjectRecord }) {
  return (
    <div className="min-w-0">
      <div className="text-right text-sm font-medium tabular-nums text-foreground">
        {projectListSpentValue(p).toFixed(2)}
      </div>
    </div>
  )
}

export function ProjectsListPage() {
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const [status, setStatus] = useState<StatusFilter>('active')
  const [clientId, setClientId] = useState('')
  const [managerId] = useState('')

  const orgQuery = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })
  const currency = orgQuery.data?.organization.defaultCurrency ?? 'USD'

  const listQuery = useQuery({
    queryKey: qk.projects,
    queryFn: () => getProjects(1, 200),
  })
  const qc = useQueryClient()
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: qk.projects })
  }

  const items = listQuery.data?.data ?? []
  const filtered = useMemo(() => {
    const qq = dq.trim().toLowerCase()
    return items.filter((p) => {
      if (status === 'active' && p.isArchived) return false
      if (status === 'archived' && !p.isArchived) return false
      if (clientId && p.clientId !== clientId) return false
      if (managerId && p.metadata?.primaryManagerUserId !== managerId) {
        return false
      }
      if (!qq) return true
      return (
        p.name.toLowerCase().includes(qq) ||
        p.clientName.toLowerCase().includes(qq)
      )
    })
  }, [items, dq, status, clientId, managerId])

  const activeCount = useMemo(
    () => items.filter((p) => !p.isArchived).length,
    [items],
  )

  const clientsInList = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of items) m.set(p.clientId, p.clientName)
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  const byClient = useMemo(() => {
    const m = new Map<string, ProjectRecord[]>()
    const sorted = [...filtered].sort((a, b) => {
      const c = a.clientName.localeCompare(b.clientName)
      if (c !== 0) return c
      return a.name.localeCompare(b.name)
    })
    for (const p of sorted) {
      const k = p.clientName
      const arr = m.get(k) ?? []
      arr.push(p)
      m.set(k, arr)
    }
    return m
  }, [filtered])

  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const allFilteredSelected = useMemo(
    () =>
      filtered.length > 0 && filtered.every((p) => selected.has(p.id)),
    [filtered, selected],
  )
  const someFilteredSelected = useMemo(
    () => filtered.some((p) => selected.has(p.id)),
    [filtered, selected],
  )
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const el = selectAllRef.current
    if (el) {
      el.indeterminate = someFilteredSelected && !allFilteredSelected
    }
  }, [someFilteredSelected, allFilteredSelected])

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((s) => {
        const n = new Set(s)
        for (const p of filtered) n.delete(p.id)
        return n
      })
    } else {
      setSelected((s) => {
        const n = new Set(s)
        for (const p of filtered) n.add(p.id)
        return n
      })
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Projects
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="h-9 gap-2 self-start sm:self-auto">
            <Link to="/projects/new">+ New project</Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by project or client"
          className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {selected.size > 0 ? (
            <>
              <BulkProjectsToolbar
                count={selected.size}
                selectedIds={Array.from(selected)}
                onClearSelection={() => setSelected(new Set())}
                onRefresh={refresh}
              />
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
            </>
          ) : null}
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            >
              <option value="active">Active projects ({activeCount})</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 max-w-xs rounded-md border border-border bg-white px-2 text-sm"
          >
            <option value="">Filter by client</option>
            {clientsInList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : 'Could not load the project list.'}
        </p>
      ) : null}

      {listQuery.isLoading && !listQuery.data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {!listQuery.isLoading && filtered.length === 0 && !listQuery.isError ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          No projects yet. Create one or change your filters.
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border bg-white shadow-sm">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/15 text-xs font-semibold text-muted-foreground">
                <th className="w-10 p-2">
                  {filtered.length > 0 ? (
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="size-4 rounded border-border text-primary"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      title="Select all in list"
                      aria-label="Select all projects in the current list"
                    />
                  ) : null}
                </th>
                <th className="p-2">Client / Project</th>
                <th className="p-2 text-right">Budget</th>
                <th className="min-w-[7rem] p-2 text-right">Spent</th>
                <th className="p-2 text-right">Remaining</th>
                <th className="p-2 text-right">Costs</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byClient.entries()).map(([cname, rows]) => (
                <Fragment key={cname}>
                  <tr className="bg-muted/20">
                    <td colSpan={7} className="px-2 py-1.5 text-xs font-bold text-foreground">
                      {cname}
                    </td>
                  </tr>
                  {rows.map((p) => {
                    const rem = projectRemaining(p)
                    const rPct = projectRemainingPercentOfBudget(p)
                    const budget = projectListBudgetValue(p)
                    const label = projectTypeLabelFromApi(p.billingMethod)
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          'border-b border-border/60',
                          selected.has(p.id)
                            ? selectedRowClass
                            : 'hover:bg-muted/10',
                        )}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border text-primary"
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-medium text-foreground">
                              {p.name}
                            </span>
                            <span className="inline-flex rounded border border-border bg-white px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                              {label}
                            </span>
                            {p.isPinned ? (
                              <span className="text-xs text-primary">Pinned</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2 text-right text-sm tabular-nums text-foreground">
                          {budget == null ? '' : budget.toFixed(2)}
                        </td>
                        <td className="p-2">
                          <ProgressCell p={p} />
                        </td>
                        <td className="p-2 text-right text-sm tabular-nums text-foreground">
                          {rem == null ? '' : rem.toFixed(2)}
                          {rem != null && rPct != null ? ` (${rPct.toFixed(0)}%)` : ''}
                        </td>
                        <td className="p-2 text-right text-sm tabular-nums text-foreground">
                          {formatMoney(p.costsAmount ?? 0, currency)}
                        </td>
                        <td className="p-2 text-right">
                          <ProjectRowMenu p={p} onRefresh={refresh} />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
