import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchOrganizationContext } from '@/features/clients/api'
import {
  type ApprovalsEntryStatus,
  type ApprovalsFilters,
  type ApprovalsGroupBy,
  type ApprovalsViewQuery,
  type ReportPeriod,
  fetchApprovalsView,
  fetchApprovalsFilters,
  postApproveGroup,
  postApproveAllVisible,
  postWithdrawGroup,
  postNotifyGroup,
  type ApprovalsView,
} from '@/features/approvals/api'
import {
  computeDateRange,
  formatDateRangeLabel,
  navigatePeriod,
  returnToCurrentRange,
} from '@/features/approvals/period'
import { ApiError } from '@/lib/api/http'
import { cn } from '@/lib/utils'

const inputCls =
  'rounded-md border border-border bg-white px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'
const selectCls =
  'max-w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'
const linkCls = 'text-sm text-primary hover:underline'

const statusLabels: Record<ApprovalsEntryStatus, string> = {
  UNSUBMITTED: 'Unsubmitted',
  SUBMITTED: 'Pending approval',
  APPROVED: 'Approved',
  ALL: 'All',
}

const groupLabels: Record<ApprovalsGroupBy, string> = {
  PERSON: 'Person',
  PROJECT: 'Project',
  CLIENT: 'Client',
}

const periodLabels: Record<ReportPeriod, string> = {
  DAY: 'Day',
  WEEK: 'Week',
  SEMIMONTH: 'Semimonth',
  MONTH: 'Month',
  QUARTER: 'Quarter',
  CUSTOM: 'Custom',
}

function formatHours(n: number): string {
  const h = Math.floor(n)
  const m = Math.round((n - h) * 60) % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}

function formatPercent(part: number, total: number): string {
  if (total <= 0) {
    return '0%'
  }
  return `${Math.round((part / total) * 1000) / 10}%`
}

function returnLinkWording(period: ReportPeriod): string {
  switch (period) {
    case 'DAY':
      return 'Return to this day'
    case 'WEEK':
      return 'Return to this week'
    case 'SEMIMONTH':
      return 'Return to this half-month'
    case 'MONTH':
      return 'Return to this month'
    case 'QUARTER':
      return 'Return to this quarter'
    case 'CUSTOM':
      return 'Return to this week'
    default:
      return 'Return to this week'
  }
}

function tagKey(kind: 'client' | 'project' | 'role' | 'teammate', id: string) {
  return `${kind}:${id}`
}

function parseTagKey(
  k: string,
): { kind: 'client' | 'project' | 'role' | 'teammate'; id: string } | null {
  const p = k.indexOf(':')
  if (p <= 0) {
    return null
  }
  const kind = k.slice(0, p) as 'client' | 'project' | 'role' | 'teammate'
  if (!['client', 'project', 'role', 'teammate'].includes(kind)) {
    return null
  }
  return { kind, id: k.slice(p + 1) }
}

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

type MultiIdSet = {
  clientIds: Set<string>
  projectIds: Set<string>
  roleIds: Set<string>
  userIds: Set<string>
}

type FilterMultiProps = {
  label: string
  ids: Set<string>
  onChange: (next: Set<string>) => void
  options: { id: string; label: string }[]
  badgeClassName?: string
}

function FilterMulti({
  label,
  ids,
  onChange,
  options,
  badgeClassName = 'min-w-5 bg-orange-500',
}: FilterMultiProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsideClick(open, close, ref)

  const allIds = useMemo(() => new Set(options.map((o) => o.id)), [options])
  const n = ids.size
  const allOn = n > 0 && n === allIds.size && allIds.size > 0
  const some = n > 0 && n < allIds.size

  function toggle(id: string) {
    const next = new Set(ids)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange(next)
  }

  function selectAll() {
    onChange(new Set(allIds))
  }

  function clearSel() {
    onChange(new Set())
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-sm text-foreground shadow-sm hover:bg-muted/30"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{label}</span>
        {n > 0 ? (
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs font-medium text-white',
              badgeClassName,
            )}
          >
            {n}
          </span>
        ) : null}
        <span className="text-muted-foreground" aria-hidden>
          ▼
        </span>
      </button>
      {open ? (
        <div
          className="absolute z-30 mt-1 w-64 rounded-md border border-border bg-white py-1.5 text-sm shadow-lg"
          role="listbox"
        >
          <label className="flex cursor-pointer items-center gap-2 border-b border-border/80 px-3 py-1.5 hover:bg-muted/20">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={allOn}
              ref={(el) => {
                if (el) {
                  el.indeterminate = !allOn && some
                }
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  selectAll()
                } else {
                  clearSel()
                }
              }}
            />
            <span className="font-medium">Select all</span>
          </label>
          <div className="max-h-60 overflow-y-auto">
            {options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/20"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={ids.has(o.id)}
                  onChange={() => toggle(o.id)}
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type ApprovalsPageInnerProps = {
  orgId: string
  systemRole: string
  orgCurrency: string
}

function ApprovalsPageBody({
  orgId,
  systemRole,
  orgCurrency,
}: ApprovalsPageInnerProps) {
  const queryClient = useQueryClient()
  const isApprover = systemRole === 'ADMINISTRATOR' || systemRole === 'MANAGER'

  const [period, setPeriod] = useState<ReportPeriod>('WEEK')
  const [anchor, setAnchor] = useState(() => new Date())
  const [custom, setCustom] = useState<{ from: Date; to: Date } | null>(null)
  const [entryStatus, setEntryStatus] =
    useState<ApprovalsEntryStatus>('SUBMITTED')
  const [groupBy, setGroupBy] = useState<ApprovalsGroupBy>('PERSON')
  const [filterIds, setFilterIds] = useState<MultiIdSet>({
    clientIds: new Set(),
    projectIds: new Set(),
    roleIds: new Set(),
    userIds: new Set(),
  })

  const { data: filters } = useQuery({
    queryKey: ['approvals', 'filters', orgId],
    queryFn: () => fetchApprovalsFilters(orgId),
    enabled: isApprover,
  })

  const { from, to } = useMemo(
    () => computeDateRange(period, anchor, custom),
    [period, anchor, custom],
  )

  const isViewingCurrentWeek = useMemo(() => {
    if (period !== 'WEEK') {
      return false
    }
    const cur = computeDateRange('WEEK', new Date(), null)
    return (
      from.getTime() === cur.from.getTime() &&
      to.getTime() === cur.to.getTime()
    )
  }, [period, from, to])

  const viewQuery: ApprovalsViewQuery = useMemo(
    () => ({
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      entryStatus,
      clientIds: filterIds.clientIds.size
        ? [...filterIds.clientIds]
        : undefined,
      projectIds: filterIds.projectIds.size
        ? [...filterIds.projectIds]
        : undefined,
      roleIds: filterIds.roleIds.size ? [...filterIds.roleIds] : undefined,
      userIds: filterIds.userIds.size ? [...filterIds.userIds] : undefined,
    }),
    [from, to, groupBy, entryStatus, filterIds],
  )

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['approvals', 'view', orgId, viewQuery],
    queryFn: () => fetchApprovalsView(viewQuery, orgId),
    enabled: isApprover,
  })

  const onPrev = useCallback(() => {
    if (period === 'CUSTOM' && !custom) {
      return
    }
    const { nextAnchor, nextCustom } = navigatePeriod(period, anchor, -1, custom)
    if (period === 'CUSTOM' && nextCustom) {
      setCustom(nextCustom)
    } else {
      setAnchor(nextAnchor)
    }
  }, [period, anchor, custom])

  const onNext = useCallback(() => {
    if (period === 'CUSTOM' && !custom) {
      return
    }
    const { nextAnchor, nextCustom } = navigatePeriod(period, anchor, 1, custom)
    if (period === 'CUSTOM' && nextCustom) {
      setCustom(nextCustom)
    } else {
      setAnchor(nextAnchor)
    }
  }, [period, anchor, custom])

  const onReturnCurrent = useCallback(() => {
    const { anchor: a, custom: c } = returnToCurrentRange(period)
    setAnchor(a)
    if (c) {
      setCustom(c)
    }
  }, [period])

  const changePeriod = useCallback(
    (p: ReportPeriod) => {
      if (p === 'CUSTOM' && p !== period) {
        const cur = computeDateRange(period, anchor, custom)
        setCustom({ from: cur.from, to: cur.to })
        setPeriod('CUSTOM')
        return
      }
      setPeriod(p)
    },
    [period, anchor, custom],
  )

  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const errMsg =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not load approvals.'
        : null

  const inv = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['approvals', 'view', orgId] })
  }, [orgId, queryClient])

  const mutApprove = useMutation({
    mutationFn: (groupId: string) => postApproveGroup(viewQuery, groupId, orgId),
    onSuccess: inv,
  })
  const mutWithdraw = useMutation({
    mutationFn: (groupId: string) => postWithdrawGroup(viewQuery, groupId, orgId),
    onSuccess: inv,
  })
  const mutNotify = useMutation({
    mutationFn: (groupId: string) => postNotifyGroup(viewQuery, groupId, orgId),
  })
  const mutApproveAll = useMutation({
    mutationFn: () => postApproveAllVisible(viewQuery, orgId),
    onSuccess: inv,
  })

  if (!isApprover) {
    return (
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-950">
        You need an administrator or manager role to use Approvals. Contact an org
        admin if you believe this is a mistake.
      </div>
    )
  }

  const hasActiveFilters =
    filterIds.clientIds.size +
      filterIds.projectIds.size +
      filterIds.roleIds.size +
      filterIds.userIds.size >
    0

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Approvals
      </h1>

      {/* Top control row */}
      <div className="flex flex-col gap-3 border-b border-border/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="shrink-0 text-sm text-muted-foreground"
              htmlFor="approvals-period"
            >
              Time period
            </label>
            <select
              id="approvals-period"
              className={selectCls}
              value={period}
              onChange={(e) => changePeriod(e.target.value as ReportPeriod)}
            >
              {(Object.keys(periodLabels) as ReportPeriod[]).map((k) => (
                <option key={k} value={k}>
                  {periodLabels[k]}
                </option>
              ))}
            </select>
            {period === 'CUSTOM' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  className={inputCls}
                  value={custom ? custom.from.toISOString().slice(0, 10) : ''}
                  onChange={(e) => {
                    const s = e.target.value
                    if (!s) {
                      return
                    }
                    const f = new Date(s + 'T00:00:00')
                    setCustom((c) => {
                      if (!c) {
                        return { from: f, to: f }
                      }
                      const t = c.to < f ? f : c.to
                      return { from: f, to: t }
                    })
                  }}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="date"
                  className={inputCls}
                  value={custom ? custom.to.toISOString().slice(0, 10) : ''}
                  onChange={(e) => {
                    const s = e.target.value
                    if (!s) {
                      return
                    }
                    const t = new Date(s + 'T00:00:00')
                    setCustom((c) => {
                      if (!c) {
                        return { from: t, to: t }
                      }
                      const f = c.from > t ? t : c.from
                      return { from: f, to: t }
                    })
                  }}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white hover:bg-muted/30"
                onClick={onPrev}
                aria-label="Previous range"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div
                className="flex min-w-0 items-center justify-center gap-1.5 px-2 text-sm"
                title="Selected range"
              >
                <Calendar
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="whitespace-nowrap font-medium text-foreground">
                  {formatDateRangeLabel(from, to)}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white hover:bg-muted/30"
                onClick={onNext}
                aria-label="Next range"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            {!isViewingCurrentWeek ? (
              <button type="button" className={linkCls} onClick={onReturnCurrent}>
                {returnLinkWording(period)}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <label
              className="shrink-0 text-sm text-muted-foreground"
              htmlFor="approvals-status"
            >
              Status
            </label>
            <select
              id="approvals-status"
              className={selectCls}
              value={entryStatus}
              onChange={(e) => setEntryStatus(e.target.value as ApprovalsEntryStatus)}
            >
              {(Object.keys(statusLabels) as ApprovalsEntryStatus[]).map((k) => (
                <option key={k} value={k}>
                  {statusLabels[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              className="shrink-0 text-sm text-muted-foreground"
              htmlFor="approvals-group-by"
            >
              Group by
            </label>
            <select
              id="approvals-group-by"
              className={selectCls}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as ApprovalsGroupBy)}
            >
              {(Object.keys(groupLabels) as ApprovalsGroupBy[]).map((k) => (
                <option key={k} value={k}>
                  {groupLabels[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter row + tags */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Filter</p>
        {filters ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <FilterMulti
                  label="Client"
                  ids={filterIds.clientIds}
                  onChange={(s) => setFilterIds((f) => ({ ...f, clientIds: s }))}
                  options={filters.clients.map((c) => ({
                    id: c.id,
                    label: c.name,
                  }))}
                />
                <FilterMulti
                  label="Project"
                  ids={filterIds.projectIds}
                  onChange={(s) => setFilterIds((f) => ({ ...f, projectIds: s }))}
                  options={filters.projects.map((p) => ({
                    id: p.id,
                    label: p.name,
                  }))}
                />
                <FilterMulti
                  label="Role"
                  ids={filterIds.roleIds}
                  onChange={(s) => setFilterIds((f) => ({ ...f, roleIds: s }))}
                  options={filters.roles.map((r) => ({ id: r.id, label: r.name }))}
                />
                <FilterMulti
                  label="Teammate"
                  ids={filterIds.userIds}
                  onChange={(s) => setFilterIds((f) => ({ ...f, userIds: s }))}
                  options={filters.teammates.map((t) => ({
                    id: t.userId,
                    label: t.label,
                  }))}
                />
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className={cn(linkCls, 'shrink-0 sm:ml-2')}
                  onClick={() =>
                    setFilterIds({
                      clientIds: new Set(),
                      projectIds: new Set(),
                      roleIds: new Set(),
                      userIds: new Set(),
                    })
                  }
                >
                  Clear all filters
                </button>
              ) : null}
            </div>
            {hasActiveFilters ? (
              <div className="flex flex-wrap gap-2">
                <FilterChips
                  filterIds={filterIds}
                  filters={filters}
                  onRemove={(k) => {
                    const p = parseTagKey(k)
                    if (!p) {
                      return
                    }
                    setFilterIds((prev) => {
                      const n = { ...prev }
                      if (p.kind === 'client') {
                        const s = new Set(n.clientIds)
                        s.delete(p.id)
                        n.clientIds = s
                      } else if (p.kind === 'project') {
                        const s = new Set(n.projectIds)
                        s.delete(p.id)
                        n.projectIds = s
                      } else if (p.kind === 'role') {
                        const s = new Set(n.roleIds)
                        s.delete(p.id)
                        n.roleIds = s
                      } else {
                        const s = new Set(n.userIds)
                        s.delete(p.id)
                        n.userIds = s
                      }
                      return n
                    })
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading filters…</p>
        )}
      </div>

      {/* Summary */}
      {data && (
        <SummaryRow
          view={data}
          isFetching={isFetching}
          orgCurrency={orgCurrency}
        />
      )}

      {errMsg ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {errMsg}
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {data && !isLoading && (
        <TableSection
          view={data}
          groupBy={groupBy}
          orgCurrency={orgCurrency}
          selected={selected}
          onToggleSelect={(k, checked) => {
            setSelected((prev) => {
              const n = new Set(prev)
              if (checked) {
                n.add(k)
              } else {
                n.delete(k)
              }
              return n
            })
          }}
          onSelectAllPage={(all, rowIds) => {
            if (all) {
              setSelected(new Set(rowIds))
            } else {
              setSelected(new Set())
            }
          }}
          onApprove={(gid) => mutApprove.mutate(gid)}
          onWithdraw={(gid) => mutWithdraw.mutate(gid)}
          onNotify={(gid) => mutNotify.mutate(gid)}
          onApproveAll={() => {
            if (
              !window.confirm(
                'Approve all time and expenses in the current view for visible rows with pending items?',
              )
            ) {
              return
            }
            mutApproveAll.mutate()
          }}
          busyApproveId={mutApprove.isPending ? mutApprove.variables : null}
          busyWithdrawId={mutWithdraw.isPending ? mutWithdraw.variables : null}
          busyNotifyId={mutNotify.isPending ? mutNotify.variables : null}
          approveAllBusy={mutApproveAll.isPending}
        />
      )}
    </div>
  )
}

function FilterChips({
  filterIds,
  filters,
  onRemove,
}: {
  filterIds: MultiIdSet
  filters: ApprovalsFilters
  onRemove: (key: string) => void
}) {
  const items: { key: string; label: string }[] = []
  for (const id of filterIds.clientIds) {
    const c = filters.clients.find((x) => x.id === id)
    if (c) {
      items.push({ key: tagKey('client', id), label: c.name })
    }
  }
  for (const id of filterIds.projectIds) {
    const c = filters.projects.find((x) => x.id === id)
    if (c) {
      items.push({ key: tagKey('project', id), label: c.name })
    }
  }
  for (const id of filterIds.roleIds) {
    const c = filters.roles.find((x) => x.id === id)
    if (c) {
      items.push({ key: tagKey('role', id), label: c.name })
    }
  }
  for (const id of filterIds.userIds) {
    const c = filters.teammates.find((x) => x.userId === id)
    if (c) {
      items.push({ key: tagKey('teammate', id), label: c.label })
    }
  }
  if (items.length === 0) {
    return null
  }
  return (
    <>
      {items.map((it) => (
        <span
          key={it.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-orange-500 bg-white px-2.5 py-0.5 text-sm text-foreground"
        >
          {it.label}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-orange-100"
            onClick={() => onRemove(it.key)}
            title="Remove filter"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
    </>
  )
}

function SummaryRow({
  view,
  isFetching,
  orgCurrency,
}: {
  view: ApprovalsView
  isFetching: boolean
  orgCurrency: string
}) {
  const s = view.summary
  const th = s.totalHours
  const bh = s.billableHours
  const nbh = s.nonBillableHours
  const be = s.billableExpense
  const nbe = s.nonBillableExpense
  const te = s.totalExpense

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 border border-border/80 bg-white md:grid-cols-2',
        isFetching && 'opacity-70',
      )}
    >
      <div className="flex border-border/60 p-4 md:border-r">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Total time</p>
          <p className="text-2xl font-semibold tabular-nums">{formatHours(th)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="inline-block size-2.5 align-middle bg-primary" /> Billable{' '}
            {formatHours(bh)} · {formatPercent(bh, th || 1)}
            <span className="mx-2" />
            <span className="inline-block size-2.5 align-middle bg-primary/35" /> Non-billable{' '}
            {formatHours(nbh)} · {formatPercent(nbh, th || 1)}
          </p>
        </div>
        {th > 0 ? (
          <div
            className="flex w-24 shrink-0 flex-col items-stretch justify-end"
            title="Share of billable hours"
          >
            <div className="h-8 w-full overflow-hidden rounded border border-border/50 bg-primary/10">
              <div
                className="h-full bg-primary"
                style={{ width: `${(bh / th) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Total expenses</p>
          <p className="text-2xl font-semibold tabular-nums">
            {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: orgCurrency || 'USD',
            }).format(te)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="inline-block size-2.5 align-middle bg-primary" /> Billable{' '}
            {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: orgCurrency || 'USD',
            }).format(be)}{' '}
            · {te > 0 ? formatPercent(be, te) : '0%'}
            <span className="mx-2" />
            <span className="inline-block size-2.5 align-middle bg-primary/35" /> Non-billable{' '}
            {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: orgCurrency || 'USD',
            }).format(nbe)}{' '}
            · {te > 0 ? formatPercent(nbe, te) : '0%'}
          </p>
        </div>
        {te > 0 ? (
          <div
            className="flex w-24 shrink-0 flex-col items-stretch justify-end"
            title="Share of billable expenses"
          >
            <div className="h-8 w-full overflow-hidden rounded border border-border/50 bg-primary/10">
              <div
                className="h-full bg-primary"
                style={{ width: `${(be / te) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function rowDisplayKey(r: {
  groupId: string
  lineLabel: string
}): string {
  return r.groupId + r.lineLabel
}

function TableSection({
  view,
  groupBy,
  orgCurrency,
  selected,
  onToggleSelect,
  onSelectAllPage,
  onApprove,
  onWithdraw,
  onNotify,
  onApproveAll,
  busyApproveId,
  busyWithdrawId,
  busyNotifyId,
  approveAllBusy,
}: {
  view: ApprovalsView
  groupBy: ApprovalsGroupBy
  orgCurrency: string
  selected: Set<string>
  onToggleSelect: (k: string, c: boolean) => void
  onSelectAllPage: (all: boolean, rowIds: string[]) => void
  onApprove: (groupId: string) => void
  onWithdraw: (groupId: string) => void
  onNotify: (groupId: string) => void
  onApproveAll: () => void
  busyApproveId: string | null
  busyWithdrawId: string | null
  busyNotifyId: string | null
  approveAllBusy: boolean
}) {
  const rows = view.rows
  const col =
    groupBy === 'PERSON' ? 'Teammate' : groupBy === 'PROJECT' ? 'Project' : 'Client'

  const allIds = rows.map((r) => rowDisplayKey(r))
  const allSel = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSel = allIds.some((id) => selected.has(id)) && !allSel

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border/80 bg-white shadow-sm">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground">
              <th className="w-10 p-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={allSel}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someSel
                    }
                  }}
                  onChange={(e) => onSelectAllPage(e.target.checked, allIds)}
                  title="Select all in view"
                />
              </th>
              <th className="p-2 font-medium text-foreground">{col}</th>
              <th className="p-2 font-medium text-foreground">Hours</th>
              <th className="p-2 font-medium text-foreground">Billable hours</th>
              <th className="p-2 font-medium text-foreground">Billable expenses</th>
              <th className="p-2 font-medium text-foreground">Non-billable expenses</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No rows for this view.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.groupId} className="border-b border-border/60">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={selected.has(rowDisplayKey(r))}
                      onChange={(e) => onToggleSelect(rowDisplayKey(r), e.target.checked)}
                    />
                  </td>
                  <td className="p-2">
                    {groupBy === 'PERSON' && r.rowUser ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {initialsFrom(r.rowUser.firstName, r.rowUser.lastName)}
                        </span>
                        <div>
                          <a
                            href={`mailto:${r.rowUser.email}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {r.lineLabel}
                          </a>
                          {r.lineSub ? (
                            <p className="text-xs text-muted-foreground">{r.lineSub}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium text-foreground">{r.lineLabel}</span>
                        {r.lineSub ? (
                          <p className="text-xs text-muted-foreground">{r.lineSub}</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-medium tabular-nums">{formatHours(r.hours)}</td>
                  <td className="p-2">
                    <div className="flex min-w-0 max-w-xs flex-col gap-1">
                      <div className="h-2.5 w-full max-w-48 overflow-hidden rounded bg-primary/10">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width:
                              r.hours > 0 ? `${(r.billableHours / r.hours) * 100}%` : '0%',
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatHours(r.billableHours)} (
                        {r.hours > 0
                          ? formatPercent(r.billableHours, r.hours)
                          : '0%'}
                        )
                      </span>
                    </div>
                  </td>
                  <td className="p-2 font-medium tabular-nums text-foreground">
                    {new Intl.NumberFormat('en-GB', {
                      style: 'currency',
                      currency: orgCurrency || 'USD',
                    }).format(r.billableExpense)}
                  </td>
                  <td className="p-2 font-medium tabular-nums text-foreground">
                    {new Intl.NumberFormat('en-GB', {
                      style: 'currency',
                      currency: orgCurrency || 'USD',
                    }).format(r.nonBillableExpense)}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onNotify(r.groupId)}
                        disabled={
                          busyApproveId != null ||
                          busyWithdrawId != null ||
                          busyNotifyId != null
                        }
                      >
                        {busyNotifyId === r.groupId ? '…' : 'Send email'}
                      </Button>
                      {r.hasApprovableSubmitted ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => onApprove(r.groupId)}
                          disabled={
                            busyApproveId != null ||
                            busyWithdrawId != null ||
                            busyNotifyId != null
                          }
                        >
                          {busyApproveId === r.groupId ? '…' : 'Approve'}
                        </Button>
                      ) : null}
                      {r.canWithdraw ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onWithdraw(r.groupId)}
                          disabled={
                            busyApproveId != null ||
                            busyWithdrawId != null ||
                            busyNotifyId != null
                          }
                        >
                          {busyWithdrawId === r.groupId ? '…' : 'Withdraw'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pt-1">
        <Button
          type="button"
          className="h-9 w-full min-w-0 gap-2 sm:w-auto"
          onClick={onApproveAll}
          disabled={
            approveAllBusy ||
            rows.length === 0 ||
            !rows.some((r) => r.hasApprovableSubmitted)
          }
        >
          {approveAllBusy ? 'Working…' : 'Approve visible timesheets and expenses'}
        </Button>
      </div>
    </div>
  )
}

function initialsFrom(first: string, last: string) {
  const a = (first[0] ?? '').toUpperCase()
  const b = (last[0] ?? '').toUpperCase()
  return (a + b) || '—'
}

export function ApprovalsPage() {
  const q = useQuery({
    queryKey: ['org', 'context', 'for-approvals'],
    queryFn: () => fetchOrganizationContext(),
  })

  const { data, error, isLoading } = q
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error instanceof Error ? error.message : 'Failed to load organization context.'}
      </p>
    )
  }
  return (
    <ApprovalsPageBody
      orgId={data.organizationId}
      systemRole={data.systemRole}
      orgCurrency={data.organization.defaultCurrency || 'USD'}
    />
  )
}
