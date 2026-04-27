import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inputCls } from '@/features/clients/client-form-helpers'
import {
  getMemberProjectAssignments,
  setMemberProjectAssignments,
  type MemberProjectClientGroup,
  type MemberProjectAssignmentsResponse,
} from '@/features/team/api'

type Pending = {
  projectId: string
  clientName: string
  name: string
  code: string | null
  isManager: boolean
}

function labelForProject(name: string, code: string | null) {
  if (code && code.trim()) return `[${code.trim()}] ${name}`
  return name
}

function buildIndex(data: MemberProjectAssignmentsResponse) {
  const byId = new Map<
    string,
    { clientName: string; name: string; code: string | null; isManager: boolean }
  >()
  for (const c of data.clients) {
    for (const p of c.projects) {
      byId.set(p.id, {
        clientName: c.name,
        name: p.name,
        code: p.code,
        isManager: p.isManager,
      })
    }
  }
  return byId
}

function pendingFromData(data: MemberProjectAssignmentsResponse): Pending[] {
  const out: Pending[] = []
  for (const c of data.clients) {
    for (const p of c.projects) {
      if (!p.isAssigned) continue
      out.push({
        projectId: p.id,
        clientName: c.name,
        name: p.name,
        code: p.code,
        isManager: p.isManager,
      })
    }
  }
  out.sort(
    (a, b) =>
      a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name),
  )
  return out
}

function samePending(a: Pending[], b: Pending[]): boolean {
  if (a.length !== b.length) return false
  const as = new Map(a.map((x) => [x.projectId, x] as const))
  for (const p of b) {
    const o = as.get(p.projectId)
    if (!o || o.isManager !== p.isManager) return false
  }
  return true
}

/** Harvest-style orange checkboxes */
const cbCls = 'size-4 accent-orange-500'

function showClientSubline(p: Pending): boolean {
  const c = p.clientName.trim()
  if (!c) return false
  if (c.toLowerCase() === p.name.trim().toLowerCase()) return false
  return true
}

/** 单行删除后底部提示，可点 Reassign 恢复 */
type RemovalFeedback = Pending

export function TeamMemberAssignedProjectsPanel(props: {
  memberId: string
  firstName: string
  isActive: boolean
  canEdit: boolean
}) {
  const { memberId, firstName, isActive, canEdit } = props
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  /** 进入页面时与 Harvest 一致：先只显示搜索 + Assign，树状列表点击/聚焦搜索再展开 */
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [futureLocal, setFutureLocal] = useState<boolean | null>(null)
  const [futureDirty, setFutureDirty] = useState(false)
  const [pending, setPending] = useState<Pending[]>([])
  const [seeded, setSeeded] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<Pending[]>([])

  const [removalFeedback, setRemovalFeedback] = useState<RemovalFeedback[]>([])
  const [bulkRemovalSnapshot, setBulkRemovalSnapshot] = useState<Pending[] | null>(
    null,
  )
  const pendingBeforeRemoveAllRef = useRef<Pending[]>([])

  const q = useQuery({
    queryKey: ['team', 'member', memberId, 'project-assignments'],
    queryFn: () => getMemberProjectAssignments(memberId),
    enabled: Boolean(memberId) && isActive,
  })

  const byId = useMemo(() => (q.data ? buildIndex(q.data) : new Map()), [q.data])

  useEffect(() => {
    if (!q.data) return
    if (futureDirty) return
    setFutureLocal(q.data.assignAllFutureProjects)
  }, [futureDirty, q.data])

  useEffect(() => {
    setSeeded(false)
    setRemovalFeedback([])
    setBulkRemovalSnapshot(null)
    pendingBeforeRemoveAllRef.current = []
  }, [memberId])

  useEffect(() => {
    if (!q.data || seeded) return
    const p = pendingFromData(q.data)
    setPending(p)
    setSavedSnapshot(p)
    setSeeded(true)
  }, [q.data, seeded])

  const pendingIdSet = useMemo(
    () => new Set(pending.map((p) => p.projectId)),
    [pending],
  )

  /** 树上只显示「尚未加入下方列表」的项目，已分配的不重复出现 */
  const pickerTree: { clients: MemberProjectClientGroup[] } = useMemo(() => {
    const data = q.data
    if (!data) return { clients: [] }
    const n = search.trim().toLowerCase()
    const withoutListed = {
      ...data,
      clients: data.clients
        .map((c) => ({
          ...c,
          projects: c.projects.filter((p) => !pendingIdSet.has(p.id)),
        }))
        .filter((c) => c.projects.length > 0),
    }
    if (!n) return withoutListed
    return {
      ...withoutListed,
      clients: withoutListed.clients
        .map((c) => ({
          ...c,
          projects: c.projects.filter(
            (p) =>
              c.name.toLowerCase().includes(n)
              || p.name.toLowerCase().includes(n)
              || (p.code && p.code.toLowerCase().includes(n)),
          ),
        }))
        .filter((c) => c.projects.length > 0),
    }
  }, [q.data, search, pendingIdSet])

  const allVisiblePickerProjectIds = useMemo(() => {
    const ids: string[] = []
    for (const c of pickerTree.clients) {
      for (const p of c.projects) ids.push(p.id)
    }
    return ids
  }, [pickerTree.clients])

  const hasSavedAssignmentInDb = useMemo(
    () =>
      Boolean(
        q.data?.clients.some((c) => c.projects.some((p) => p.isAssigned)),
      ),
    [q.data],
  )

  const assignMut = useMutation({
    mutationFn: (list: Pending[]) => {
      const body = {
        assignments: list.map((p) => ({
          projectId: p.projectId,
          isManager: p.isManager,
        })),
        assignAllFutureProjects:
          futureLocal ?? q.data?.assignAllFutureProjects ?? false,
      }
      return setMemberProjectAssignments(memberId, body)
    },
    onSuccess: async (data) => {
      setFutureDirty(false)
      setFutureLocal(data.assignAllFutureProjects)
      setRemovalFeedback([])
      setBulkRemovalSnapshot(null)
      const next = pendingFromData(data)
      setPending(next)
      setSavedSnapshot(next)
      setSeeded(true)
      await qc.invalidateQueries({ queryKey: ['team', 'member', memberId] })
      await q.refetch()
    },
    onError: () => {
      void q.refetch()
    },
  })

  const removeAllMut = useMutation({
    mutationFn: () =>
      setMemberProjectAssignments(memberId, {
        assignments: [],
        assignAllFutureProjects:
          futureLocal ?? q.data?.assignAllFutureProjects ?? false,
      }),
    onSuccess: async (data) => {
      const next = pendingFromData(data)
      setPending(next)
      setSavedSnapshot(next)
      setFutureLocal(data.assignAllFutureProjects)
      setFutureDirty(false)
      setSeeded(true)
      const before = pendingBeforeRemoveAllRef.current
      if (before.length) {
        setBulkRemovalSnapshot(before)
        setRemovalFeedback([])
      }
      pendingBeforeRemoveAllRef.current = []
      await qc.invalidateQueries({ queryKey: ['team', 'member', memberId] })
      await q.refetch()
    },
  })

  const isDirty = useMemo(
    () => !samePending(pending, savedSnapshot),
    [pending, savedSnapshot],
  )

  const setManagerAll = useCallback((v: boolean) => {
    setPending((prev) => prev.map((p) => ({ ...p, isManager: v })))
  }, [])

  const mergeIntoPending = useCallback((row: Pending, prev: Pending[]) => {
    const map = new Map(prev.map((p) => [p.projectId, p] as const))
    map.set(row.projectId, row)
    return [...map.values()].sort(
      (a, b) =>
        a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name),
    )
  }, [])

  const removeFromListWithFeedback = useCallback(
    (row: Pending) => {
      if (!canEdit) return
      setPending((prev) => {
        const next = prev.filter((p) => p.projectId !== row.projectId)
        queueMicrotask(() => assignMut.mutate(next))
        return next
      })
      setRemovalFeedback((rf) => {
        if (rf.some((x) => x.projectId === row.projectId)) return rf
        return [...rf, row]
      })
      setBulkRemovalSnapshot((snap) =>
        snap?.some((s) => s.projectId === row.projectId) ? null : snap,
      )
    },
    [canEdit, assignMut],
  )

  const reassignOneFeedback = useCallback(
    (row: RemovalFeedback) => {
      if (!canEdit) return
      setRemovalFeedback((rf) => rf.filter((x) => x.projectId !== row.projectId))
      setPending((prev) => {
        const next = mergeIntoPending(row, prev)
        queueMicrotask(() => assignMut.mutate(next))
        return next
      })
    },
    [canEdit, mergeIntoPending, assignMut],
  )

  const reassignAllInHeader = useCallback(() => {
    if (!canEdit) return
    setPending((prev) => {
      const map = new Map(prev.map((p) => [p.projectId, p] as const))
      for (const f of removalFeedback) {
        map.set(f.projectId, f)
      }
      if (bulkRemovalSnapshot) {
        for (const f of bulkRemovalSnapshot) {
          map.set(f.projectId, f)
        }
      }
      const next = [...map.values()].sort(
        (a, b) =>
          a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name),
      )
      queueMicrotask(() => assignMut.mutate(next))
      return next
    })
    setRemovalFeedback([])
    setBulkRemovalSnapshot(null)
  }, [bulkRemovalSnapshot, canEdit, removalFeedback, assignMut])

  const toggleInPending = useCallback(
    (projectId: string) => {
      setRemovalFeedback((rf) => rf.filter((x) => x.projectId !== projectId))
      setBulkRemovalSnapshot((snap) => {
        if (!snap) return null
        if (snap.some((s) => s.projectId === projectId)) return null
        return snap
      })
      setPending((prev) => {
        const has = prev.some((p) => p.projectId === projectId)
        if (has) {
          const next = prev.filter((p) => p.projectId !== projectId)
          queueMicrotask(() => assignMut.mutate(next))
          return next
        }
        const meta = byId.get(projectId)
        if (!meta) return prev
        const next: Pending = {
          projectId,
          clientName: meta.clientName,
          name: meta.name,
          code: meta.code,
          isManager: true,
        }
        return mergeIntoPending(next, prev)
      })
    },
    [byId, mergeIntoPending, assignMut],
  )

  const setManager = useCallback((projectId: string, isManager: boolean) => {
    setPending((prev) =>
      prev.map((p) => (p.projectId === projectId ? { ...p, isManager } : p)),
    )
  }, [])

  const addAllVisiblePickerToPending = useCallback(() => {
    if (allVisiblePickerProjectIds.length === 0) return
    const addIds = new Set(allVisiblePickerProjectIds)
    setRemovalFeedback((rf) => rf.filter((x) => !addIds.has(x.projectId)))
    setBulkRemovalSnapshot((snap) => {
      if (!snap) return null
      if (snap.some((s) => addIds.has(s.projectId))) return null
      return snap
    })
    setPending((prev) => {
      const map = new Map(prev.map((p) => [p.projectId, p] as const))
      for (const id of allVisiblePickerProjectIds) {
        const meta = byId.get(id)
        if (!meta) continue
        if (!map.has(id)) {
          map.set(id, {
            projectId: id,
            clientName: meta.clientName,
            name: meta.name,
            code: meta.code,
            isManager: true,
          })
        }
      }
      return [...map.values()].sort(
        (a, b) =>
          a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name),
      )
    })
  }, [allVisiblePickerProjectIds, byId])

  const pickerEmptyMessage = useMemo(() => {
    if (!q.data) return 'No active projects in this account.'
    if (!q.data.clients.some((c) => c.projects.length)) {
      return 'No active projects in this account.'
    }
    const anyNotListed = q.data.clients.some((c) =>
      c.projects.some((p) => !pendingIdSet.has(p.id)),
    )
    if (!anyNotListed) {
      return 'All projects are already in the list below.'
    }
    return 'No projects found.'
  }, [q.data, pendingIdSet])

  const getClientProjectIds = useCallback(
    (clientId: string) => {
      const c = q.data?.clients.find((x) => x.id === clientId)
      return c?.projects.map((p) => p.id) ?? []
    },
    [q.data?.clients],
  )

  const clientAllSelected = useCallback(
    (clientId: string) => {
      const ids = getClientProjectIds(clientId)
      return (
        ids.length > 0 && ids.every((id) => pending.some((p) => p.projectId === id))
      )
    },
    [getClientProjectIds, pending],
  )

  const toggleClient = useCallback(
    (clientId: string) => {
      const ids = getClientProjectIds(clientId)
      if (ids.length === 0) return
      if (clientAllSelected(clientId)) {
        setPending((prev) => {
          const removed = prev.filter((p) => ids.includes(p.projectId))
          const next = prev.filter((p) => !ids.includes(p.projectId))
          if (removed.length) {
            queueMicrotask(() => {
              assignMut.mutate(next)
              setRemovalFeedback((rf) => {
                const ex = new Set(rf.map((x) => x.projectId))
                return [
                  ...rf,
                  ...removed.filter((r) => !ex.has(r.projectId)),
                ]
              })
              setBulkRemovalSnapshot((snap) => {
                if (!snap) return null
                if (removed.some((r) => snap.some((s) => s.projectId === r.projectId))) {
                  return null
                }
                return snap
              })
            })
          }
          return next
        })
        return
      }
      setPending((prev) => {
        const map = new Map(prev.map((p) => [p.projectId, p] as const))
        for (const id of ids) {
          const meta = byId.get(id)
          if (!meta) continue
          if (!map.has(id)) {
            map.set(id, {
              projectId: id,
              clientName: meta.clientName,
              name: meta.name,
              code: meta.code,
              isManager: true,
            })
          }
        }
        return [...map.values()].sort(
          (a, b) =>
            a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name),
        )
      })
    },
    [byId, clientAllSelected, getClientProjectIds, assignMut],
  )

  const futureChecked =
    futureLocal ?? q.data?.assignAllFutureProjects ?? false

  function onRemoveAll() {
    if (!canEdit) return
    if (
      !window.confirm(
        `Remove ${firstName} from all projects? They will stop being able to track time to those projects until you assign them again.`,
      )
    ) {
      return
    }
    pendingBeforeRemoveAllRef.current = [...pending]
    removeAllMut.mutate()
  }

  const canReassignAll =
    canEdit && (removalFeedback.length > 0 || (bulkRemovalSnapshot?.length ?? 0) > 0)

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {firstName}&apos;s assigned projects
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {firstName} can track time and expenses to the projects they&apos;re
        assigned, as well as report on and edit projects they manage.
      </p>

      {!canEdit ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Only administrators and managers can change project assignments.
        </p>
      ) : null}

      {/* Picker: Harvest-like soft panel */}
      <div
        className={cn(
          'relative mt-6 rounded-lg border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm',
        )}
      >
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            className={cn(inputCls, 'h-10 w-full pl-9')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => {
              setDropdownOpen(true)
              const t = e.currentTarget
              const len = t.value.length
              requestAnimationFrame(() => {
                t.setSelectionRange(len, len)
              })
            }}
            placeholder="Find and select projects to assign…"
            aria-label="Find and select projects to assign"
          />
        </div>

        {dropdownOpen ? (
          <div className="mt-3 overflow-hidden rounded-md border border-amber-200/90 bg-white">
            <div className="max-h-72 overflow-auto p-3 text-sm">
              {q.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : q.isError ? (
                <div className="text-sm text-destructive">
                  Failed to load projects.
                </div>
              ) : (
                <>
                  <div className="border-b border-border/60 pb-2">
                    <button
                      type="button"
                      className="text-left text-sm font-medium text-foreground hover:underline disabled:opacity-40"
                      onClick={addAllVisiblePickerToPending}
                      disabled={!canEdit || allVisiblePickerProjectIds.length === 0}
                    >
                      Select all
                    </button>
                  </div>
                  <div className="mt-2 space-y-3">
                    {pickerTree.clients.map((c) => (
                      <div key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                          <input
                            type="checkbox"
                            className={cbCls}
                            checked={clientAllSelected(c.id)}
                            onChange={() => toggleClient(c.id)}
                            disabled={!canEdit}
                          />
                          <span>{c.name}</span>
                        </label>
                        <div className="ml-6 mt-1 space-y-1.5">
                          {c.projects.map((p) => (
                            <label
                              key={p.id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className={cbCls}
                                checked={false}
                                onChange={() => toggleInPending(p.id)}
                                disabled={!canEdit}
                              />
                              <span>{labelForProject(p.name, p.code)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {pickerTree.clients.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {pickerEmptyMessage}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100/90 bg-amber-50/50 px-3 py-2 text-sm">
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setDropdownOpen(false)}
              >
                Close list
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className={cbCls}
                  checked={futureChecked}
                  onChange={(e) => {
                    setFutureDirty(true)
                    setFutureLocal(e.target.checked)
                  }}
                  disabled={!canEdit}
                />
                <span>Also assign to all future projects</span>
              </label>
            </div>
          </div>
        ) : null}

        {isDirty || futureDirty ? (
          <p className="mt-2 text-xs text-amber-900/80">You have unsaved changes.</p>
        ) : null}

        <div className="mt-4">
          <Button
            type="button"
            className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-600/90 sm:max-w-xs"
            disabled={
              !canEdit
              || assignMut.isPending
              || (!isDirty && !futureDirty)
            }
            onClick={() => assignMut.mutate(pending)}
          >
            {assignMut.isPending ? 'Saving…' : 'Assign projects'}
          </Button>
        </div>
        {assignMut.isError ? (
          <p className="mt-2 text-sm text-destructive">
            Could not save assignments.
          </p>
        ) : null}
      </div>

      {/* Current list */}
      <div className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Assigned projects
          </h2>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-4 sm:min-w-0">
            {canEdit && hasSavedAssignmentInDb ? (
              <button
                type="button"
                className="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-40"
                onClick={onRemoveAll}
                disabled={removeAllMut.isPending}
              >
                Remove from all projects
              </button>
            ) : null}
            {canReassignAll ? (
              <button
                type="button"
                className="text-sm text-primary underline-offset-2 hover:underline"
                onClick={reassignAllInHeader}
              >
                Reassign all
              </button>
            ) : null}
            {!(canEdit && hasSavedAssignmentInDb) && !canReassignAll ? (
              <span className="hidden min-[480px]:block min-[480px]:w-0" />
            ) : null}
            <div className="text-right text-sm">
              <div className="text-xs text-muted-foreground">
                Manages this project?
              </div>
              <div className="text-xs text-muted-foreground">
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-40"
                  onClick={() => setManagerAll(true)}
                  disabled={!canEdit || pending.length === 0}
                >
                  Select all
                </button>
                <span className="mx-1">/</span>
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-40"
                  onClick={() => setManagerAll(false)}
                  disabled={!canEdit || pending.length === 0}
                >
                  None
                </button>
              </div>
            </div>
          </div>
        </div>

        {pending.length > 0
        || removalFeedback.length > 0
        || bulkRemovalSnapshot
        || hasSavedAssignmentInDb ? (
        <div className="mt-2 overflow-hidden rounded-md border border-border bg-white">
          {pending.length === 0
          && removalFeedback.length === 0
          && !bulkRemovalSnapshot
          && hasSavedAssignmentInDb ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No projects in this list. If you removed projects, click
              &quot;Assign projects&quot; in the box above to save.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((p) => (
                <li
                  key={p.projectId}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    {showClientSubline(p) ? (
                      <div className="text-xs text-muted-foreground">
                        {p.clientName}
                      </div>
                    ) : null}
                    <div className="flex min-w-0 items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 min-w-[1.5rem] rounded border border-transparent text-center text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-40"
                        onClick={() => removeFromListWithFeedback(p)}
                        disabled={!canEdit}
                        aria-label="Remove project"
                      >
                        ×
                      </button>
                      <div className="min-w-0">
                        <Link
                          to={`/projects/${p.projectId}/edit`}
                          className="break-words text-primary hover:underline"
                        >
                          {labelForProject(p.name, p.code)}
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-[140px] justify-end sm:w-[180px]">
                    <input
                      type="checkbox"
                      className={cbCls}
                      checked={p.isManager}
                      onChange={(e) => setManager(p.projectId, e.target.checked)}
                      disabled={!canEdit}
                    />
                  </div>
                </li>
              ))}

              {removalFeedback.map((fb) => (
                <li
                  key={`unassigned-${fb.projectId}`}
                  className="bg-slate-100/80 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 w-fit shrink-0 border-border bg-white px-2.5 text-xs font-medium shadow-sm"
                      onClick={() => reassignOneFeedback(fb)}
                    >
                      Reassign
                    </Button>
                    <p className="min-w-0 text-muted-foreground">
                      Successfully unassigned from{' '}
                      <span className="font-semibold text-foreground">
                        {labelForProject(fb.name, fb.code)}
                      </span>
                    </p>
                  </div>
                </li>
              ))}

              {bulkRemovalSnapshot && bulkRemovalSnapshot.length > 0 ? (
                <li key="unassigned-bulk" className="bg-slate-100/80 px-3 py-2.5 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 w-fit shrink-0 border-border bg-white px-2.5 text-xs font-medium shadow-sm"
                      onClick={reassignAllInHeader}
                    >
                      Reassign all
                    </Button>
                    <p className="text-muted-foreground">
                      Successfully unassigned from all assigned projects.
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </div>
        ) : null}
      </div>

      {!hasSavedAssignmentInDb ? (
        <div className="mt-6 rounded-md border border-amber-100 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          {firstName} is not assigned to any active projects, which means they
          can&apos;t track time yet. Assign them to a project above, or{' '}
          <Link
            to="/projects/new"
            className="text-primary underline-offset-2 hover:underline"
          >
            create a new one
          </Link>
          .
        </div>
      ) : null}

      {removeAllMut.isError ? (
        <p className="mt-2 text-sm text-destructive">Could not remove all projects.</p>
      ) : null}
    </div>
  )
}
