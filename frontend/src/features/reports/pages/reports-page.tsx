import { useQuery } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, ChevronsDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchOrganizationContext } from '@/features/clients/api'
import type { ReportPeriod } from '@/features/approvals/api'
import {
  computeDateRange,
  formatDateRangeLabel,
  navigatePeriod,
  returnToCurrentRange,
} from '@/features/approvals/period'
import { ApiError } from '@/lib/api/http'
import { cn } from '@/lib/utils'
import {
  type TimeReportGroup,
  fetchProfitabilityReport,
  fetchReportFilters,
  fetchTimeReport,
} from '@/features/reports/api'
import {
  exportProfitabilityCsv,
  exportProfitabilityPdf,
  exportTimeReportCsv,
  exportTimeReportPdf,
} from '@/features/reports/reports-export'

const inputCls =
  'rounded-md border border-border bg-white px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'

const periodOrder: ReportPeriod[] = [
  'DAY',
  'WEEK',
  'MONTH',
  'QUARTER',
  'SEMIMONTH',
  'CUSTOM',
]
const periodLabels: Record<ReportPeriod, string> = {
  DAY: 'Day',
  WEEK: 'Week',
  SEMIMONTH: 'Semimonth',
  MONTH: 'Month',
  QUARTER: 'Quarter',
  CUSTOM: 'Custom',
}

function localYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function returnLink(period: ReportPeriod) {
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
    default:
      return 'Return to this week'
  }
}

function money(currency: string, n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(n)
}

type MultiSet = { ids: Set<string>; all: { id: string; label: string }[] }
function MultiSelect({
  label,
  m,
  onChange,
}: {
  label: string
  m: MultiSet
  onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = m.all
  const ids = m.ids
  const allOn = options.length > 0 && options.every((o) => ids.has(o.id))
  const some = options.some((o) => ids.has(o.id))
  const selectAll = () => onChange(new Set(options.map((o) => o.id)))
  const clearSel = () => onChange(new Set())
  const toggle = (id: string) => {
    const n = new Set(ids)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    onChange(n)
  }
  const summary =
    ids.size === 0
      ? `All ${label}`
      : ids.size === 1
        ? options.find((o) => ids.has(o.id))?.label ?? label
        : `${ids.size} selected`

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', onDoc)
    }
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={cn(
          inputCls,
          'inline-flex w-full min-w-[9rem] items-center justify-between gap-1 text-left',
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="truncate">{summary}</span>
        <span className="shrink-0">▼</span>
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
                if (el) el.indeterminate = !allOn && some
              }}
              onChange={(e) => {
                if (e.target.checked) selectAll()
                else clearSel()
              }}
            />
            <span className="font-medium">All</span>
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

function SubTabs({
  value,
  onChange,
  ids,
}: {
  value: TimeReportGroup
  onChange: (g: TimeReportGroup) => void
  ids: { id: TimeReportGroup; label: string }[]
}) {
  return (
    <div className="flex flex-wrap border-b border-border/80" role="tablist">
      {ids.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function Donut({ billablePct, className = '' }: { billablePct: number; className?: string }) {
  const b = Math.min(100, Math.max(0, billablePct))
  return (
    <div
      className={cn('relative h-28 w-28 shrink-0', className)}
      role="img"
      aria-label={`${Math.round(b)}% billable hours`}
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background: `conic-gradient(hsl(213 78% 46%) 0% ${b}%, hsl(204 90% 88%) ${b}% 100%)`,
        }}
      />
      <div className="absolute inset-2.5 rounded-full border border-slate-100/80 bg-white" />
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
        {Math.round(b)}%
      </div>
    </div>
  )
}

function StackedBarCell({
  share,
}: {
  share: number
}) {
  return (
    <div className="h-1.5 w-24 min-w-0 overflow-hidden rounded-sm bg-slate-100">
      <div
        className="h-full rounded-sm bg-primary/80"
        style={{ width: `${Math.min(1, share) * 100}%` }}
      />
    </div>
  )
}

function profitBar(share: number) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-20 min-w-0 overflow-hidden rounded-sm bg-slate-100">
        <div
          className="h-full bg-primary/90"
          style={{ width: `${Math.min(1, share) * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs text-muted-foreground">
        {Math.round(share * 1000) / 10}%
      </span>
    </div>
  )
}

type MainTab = 'time' | 'profit'

export function ReportsPage() {
  const { data: orgCtx, isLoading: orgLoad } = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: () => fetchOrganizationContext(),
  })
  const orgId = orgCtx?.organizationId

  const { data: filters, error: fErr } = useQuery({
    queryKey: ['reports', 'filters', orgId],
    queryFn: () => fetchReportFilters(orgId),
    enabled: Boolean(orgId),
  })

  const [mainTab, setMainTab] = useState<MainTab>('time')
  const [period, setPeriod] = useState<ReportPeriod>('WEEK')
  const [anchor, setAnchor] = useState(() => new Date())
  const [custom, setCustom] = useState<{ from: Date; to: Date } | null>(null)
  const [timeGroup, setTimeGroup] = useState<TimeReportGroup>('clients')
  const [profitGroup, setProfitGroup] = useState<TimeReportGroup>('clients')
  const [exportOpen, setExportOpen] = useState(false)
  const [profitExportOpen, setProfitExportOpen] = useState(false)

  const [activeTimeOnly, setActiveTimeOnly] = useState(true)
  const [fClients, setFClients] = useState<Set<string>>(new Set())
  const [fProjects, setFProjects] = useState<Set<string>>(new Set())
  const [fUsers, setFUsers] = useState<Set<string>>(new Set())
  const [fTasks, setFTasks] = useState<Set<string>>(new Set())

  const [fCurrency, setFCurrency] = useState<string>('')
  const [fPStatus, setFPStatus] = useState<Set<string>>(() => {
    const s = new Set<string>()
    s.add('active')
    return s
  })
  const [fPType, setFPType] = useState<Set<string>>(
    () => new Set(['TM', 'FIXED_FEE', 'NON_BILLABLE']),
  )
  const [fManagers, setFManagers] = useState<Set<string>>(new Set())

  const { from, to } = useMemo(
    () => computeDateRange(period, anchor, custom),
    [period, anchor, custom],
  )

  const isViewingCurrentRange = useMemo(() => {
    const { anchor: targetA, custom: targetC } = returnToCurrentRange(period)
    const r1 = computeDateRange(period, anchor, custom)
    const r2 = computeDateRange(period, targetA, targetC)
    return (
      r1.from.getTime() === r2.from.getTime() && r1.to.getTime() === r2.to.getTime()
    )
  }, [period, anchor, custom])

  const fromYmd = localYmd(from)
  const toYmd = localYmd(to)

  const timeQ = useMemo(
    () => ({
      fromYmd,
      toYmd,
      groupBy: timeGroup,
      activeProjectsOnly: activeTimeOnly,
      clientIds: fClients.size ? [...fClients] : undefined,
      projectIds: fProjects.size ? [...fProjects] : undefined,
      userIds: fUsers.size ? [...fUsers] : undefined,
      taskIds: fTasks.size ? [...fTasks] : undefined,
    }),
    [
      fromYmd,
      toYmd,
      timeGroup,
      activeTimeOnly,
      fClients,
      fProjects,
      fUsers,
      fTasks,
    ],
  )

  const projectTypesCsv = useMemo(
    () => (fPType.size ? [...fPType].join(',') : 'TM,FIXED_FEE,NON_BILLABLE'),
    [fPType],
  )

  const projectStatusCsv = useMemo(() => {
    if (fPStatus.size === 0) return 'active,archived'
    return [...fPStatus].join(',')
  }, [fPStatus])

  const profitQ = useMemo(
    () => ({
      fromYmd,
      toYmd,
      groupBy: profitGroup,
      currency: fCurrency || undefined,
      projectStatuses: projectStatusCsv,
      projectTypes: projectTypesCsv,
      projectManagerUserIds: fManagers.size
        ? [...fManagers].join(',')
        : undefined,
    }),
    [
      fromYmd,
      toYmd,
      profitGroup,
      fCurrency,
      projectStatusCsv,
      projectTypesCsv,
      fManagers,
    ],
  )

  const {
    data: timeR,
    isLoading: tLoad,
    error: tErr,
  } = useQuery({
    queryKey: ['reports', 'time', orgId, timeQ],
    queryFn: () => fetchTimeReport(orgId, timeQ),
    enabled: Boolean(orgId) && mainTab === 'time',
  })
  const {
    data: profitR,
    isLoading: pLoad,
    error: pErr,
  } = useQuery({
    queryKey: ['reports', 'profit', orgId, profitQ],
    queryFn: () => fetchProfitabilityReport(orgId, profitQ),
    enabled: Boolean(orgId) && mainTab === 'profit',
  })

  const onPrev = useCallback(() => {
    if (period === 'CUSTOM' && !custom) return
    const { nextAnchor, nextCustom } = navigatePeriod(period, anchor, -1, custom)
    if (period === 'CUSTOM' && nextCustom) setCustom(nextCustom)
    else setAnchor(nextAnchor)
  }, [period, anchor, custom])

  const onNext = useCallback(() => {
    if (period === 'CUSTOM' && !custom) return
    const { nextAnchor, nextCustom } = navigatePeriod(period, anchor, 1, custom)
    if (period === 'CUSTOM' && nextCustom) setCustom(nextCustom)
    else setAnchor(nextAnchor)
  }, [period, anchor, custom])

  const onReturnCurrent = useCallback(() => {
    const { anchor: a, custom: c } = returnToCurrentRange(period)
    setAnchor(a)
    if (c) setCustom(c)
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

  const saveToStorage = useCallback(() => {
    if (!orgId) return
    const data = { period, fromYmd, toYmd, timeGroup, profitGroup, mainTab }
    try {
      localStorage.setItem(
        `harvestapp.reports.prefs.${orgId}`,
        JSON.stringify(data),
      )
    } catch {
      /* ignore */
    }
  }, [orgId, period, fromYmd, toYmd, timeGroup, profitGroup, mainTab])

  const clientOpts = useMemo(
    () =>
      (filters?.clients ?? []).map((c) => ({
        id: c.id,
        label: c.name,
      })),
    [filters],
  )
  const projectOpts = useMemo(
    () =>
      (filters?.projects ?? []).map((p) => ({
        id: p.id,
        label: `${p.name} (${p.clientName})`,
      })),
    [filters],
  )
  const teamOpts = useMemo(
    () =>
      (filters?.team ?? []).map((u) => ({
        id: u.userId,
        label: u.label,
      })),
    [filters],
  )
  const taskOpts = useMemo(
    () =>
      (filters?.tasks ?? []).map((t) => ({
        id: t.id,
        label: t.name,
      })),
    [filters],
  )

  useEffect(() => {
    if (filters && fCurrency === '') {
      setFCurrency(filters.currency)
    }
  }, [filters, fCurrency])

  if (orgLoad) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>
  }
  if (!orgCtx) {
    return (
      <div className="p-4 text-sm text-amber-800">Unable to load organization.</div>
    )
  }

  const tErrMsg =
    tErr instanceof ApiError
      ? tErr.message
      : tErr
        ? 'Could not load the time report.'
        : null
  const pErrMsg =
    pErr instanceof ApiError
      ? pErr.message
      : pErr
        ? 'Could not load the profitability report.'
        : null
  const fErrMsg =
    fErr instanceof ApiError
      ? fErr.message
      : fErr
        ? 'Could not load report filters.'
        : null
  const cur = orgCtx.organization.defaultCurrency

  const chartMax = profitR
    ? Math.max(1, ...profitR.series.map((s) => s.revenue + s.costs))
    : 1

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Reports
      </h1>
      {fErrMsg ? (
        <div className="rounded-md border border-amber-300 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          {fErrMsg}
        </div>
      ) : null}
      <div className="flex flex-wrap border-b border-border" role="tablist">
        {(
          [
            { id: 'time' as const, label: 'Time' },
            { id: 'profit' as const, label: 'Profitability' },
          ] as const
        ).map((t) => {
          const active = mainTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMainTab(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="report-period">
          Report period
        </label>
        <select
          id="report-period"
          className={inputCls}
          value={period}
          onChange={(e) => {
            const v = e.target.value as ReportPeriod
            changePeriod(v)
          }}
        >
          {periodOrder.map((p) => (
            <option key={p} value={p}>
              {periodLabels[p]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onPrev}
            aria-label="Previous period"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="px-1 text-sm text-foreground min-w-0 break-words">
            {formatDateRangeLabel(from, to)}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onNext}
            aria-label="Next period"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {period === 'WEEK' ||
        period === 'DAY' ||
        period === 'MONTH' ||
        period === 'QUARTER' ||
        period === 'SEMIMONTH'
          ? !isViewingCurrentRange && (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={onReturnCurrent}
              >
                {returnLink(period)}
              </button>
            )
          : null}
        <div className="ms-auto" />
        <Button type="button" variant="outline" size="sm" onClick={saveToStorage}>
          Save report
        </Button>
      </div>

      {mainTab === 'time' && (
        <>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <MultiSelect
              label="clients"
              m={{ all: clientOpts, ids: fClients }}
              onChange={setFClients}
            />
            <MultiSelect
              label="projects"
              m={{ all: projectOpts, ids: fProjects }}
              onChange={setFProjects}
            />
            <MultiSelect
              label="tasks"
              m={{ all: taskOpts, ids: fTasks }}
              onChange={setFTasks}
            />
            <MultiSelect
              label="team"
              m={{ all: teamOpts, ids: fUsers }}
              onChange={setFUsers}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={activeTimeOnly}
                onChange={(e) => setActiveTimeOnly(e.target.checked)}
              />
              <span>Active projects only</span>
            </label>
          </div>
          {tLoad ? (
            <div className="text-sm text-muted-foreground">Loading report…</div>
          ) : tErrMsg ? (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {tErrMsg}
            </div>
          ) : timeR ? (
            <div className="space-y-3">
              {timeR.summary.hasMissingRate ? (
                <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Some amounts cannot be fully calculated because required billable
                  rates are missing. Check project task, project, and member rates in
                  Settings and Projects.
                </div>
              ) : null}
              <div
                className="rounded-lg border border-border/80 bg-white p-4 shadow-sm"
                id="time-summary-print"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total hours</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {timeR.summary.totalHours.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-wrap items-end gap-6 min-w-0">
                    <Donut billablePct={timeR.summary.billableOfTotalPct} />
                    <div className="min-w-0 text-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="h-2 w-3 rounded-sm bg-primary/90" />
                        <span>Billable</span>
                        <span className="ms-1 font-medium tabular-nums">
                          {timeR.summary.billableHours.toFixed(2)}
                        </span>
                      </div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="h-2 w-3 rounded-sm bg-sky-200" />
                        <span>Non-billable</span>
                        <span className="ms-1 font-medium tabular-nums">
                          {timeR.summary.nonBillableHours.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="ms-auto text-right">
                      <p className="text-xs text-muted-foreground">Billable amount</p>
                      <p className="text-lg font-semibold text-primary">
                        {money(
                          timeR.range.currency,
                          timeR.summary.billableAmount,
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Uninvoiced amount
                      </p>
                      <p className="text-lg font-semibold">
                        {money(
                          timeR.range.currency,
                          timeR.summary.uninvoicedAmount,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2" id="time-table-print">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <SubTabs
                    value={timeGroup}
                    onChange={setTimeGroup}
                    ids={[
                      { id: 'clients', label: 'Clients' },
                      { id: 'projects', label: 'Projects' },
                      { id: 'tasks', label: 'Tasks' },
                      { id: 'team', label: 'Team' },
                    ]}
                  />
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <div className="relative">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setExportOpen((e) => !e)}
                        className="min-w-24"
                        aria-expanded={exportOpen}
                      >
                        Export <ChevronsDown className="ms-1 size-3.5" />
                      </Button>
                      {exportOpen ? (
                        <div className="absolute right-0 z-20 mt-1 w-40 rounded border border-border bg-white py-1 text-sm shadow-md">
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left hover:bg-muted/30"
                            onClick={() => {
                              exportTimeReportCsv(
                                timeR,
                                timeGroup,
                                `time-${timeGroup}`,
                              )
                              setExportOpen(false)
                            }}
                          >
                            Excel (CSV)
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left hover:bg-muted/30"
                            onClick={() => {
                              void exportTimeReportPdf(
                                timeR,
                                timeGroup,
                                `time-${timeGroup}`,
                              ).then(() => setExportOpen(false))
                            }}
                          >
                            PDF
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => globalThis.print?.()}
                      aria-label="Print"
                    >
                      <Printer className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/80">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/90">
                        <th className="p-2 font-medium">Name</th>
                        {(timeGroup === 'projects' || timeGroup === 'tasks') && (
                          <th className="p-2 font-medium">Client</th>
                        )}
                        <th className="p-2 font-medium">Hours</th>
                        {timeGroup === 'team' && (
                          <th className="p-2 font-medium">Utilization</th>
                        )}
                        <th className="p-2 font-medium">Billable hours</th>
                        <th className="p-2 font-medium">Billable amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeR.rows.map((row) => (
                        <tr
                          key={row.id + row.name}
                          className="border-b border-border/60"
                        >
                          <td className="p-2 text-primary/90">
                            {row.name}
                          </td>
                          {(timeGroup === 'projects' ||
                            timeGroup === 'tasks') && (
                            <td className="p-2 text-primary/80">
                              {row.clientName ?? '—'}
                            </td>
                          )}
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <span className="tabular-nums">
                                {row.hours.toFixed(2)}
                              </span>
                              <StackedBarCell share={row.hourShare} />
                            </div>
                          </td>
                          {timeGroup === 'team' && (
                            <td className="p-2 text-muted-foreground">
                              {row.utilizationPercent == null
                                ? '—'
                                : `${Math.round(row.utilizationPercent * 10) / 10}%`}
                            </td>
                          )}
                          <td className="p-2">
                            {row.billableHours.toFixed(2)} (
                            {row.billableHoursOfTotalPct.toFixed(0)}%)
                          </td>
                          <td className="p-2">
                            {money(
                              timeR.range.currency,
                              row.billableAmount,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/90 bg-slate-50/80 font-medium">
                        <td className="p-2">Total</td>
                        {(timeGroup === 'projects' || timeGroup === 'tasks') && (
                          <td className="p-2" />
                        )}
                        <td className="p-2 tabular-nums">
                          {timeR.totals.hours.toFixed(2)}
                        </td>
                        {timeGroup === 'team' && <td className="p-2" />}
                        <td className="p-2">
                          {timeR.totals.billableHours.toFixed(2)}
                        </td>
                        <td className="p-2">
                          {money(
                            timeR.range.currency,
                            timeR.totals.billableAmount,
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {mainTab === 'profit' && (
        <>
          {profitR?.hasMissingRate ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Some of the data in this timeframe cannot be fully calculated
              because there are missing rates. Set rates on project tasks, projects, or
              members.
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <select
                className={cn(inputCls, 'mt-0.5 w-full')}
                value={fCurrency || cur}
                onChange={(e) => setFCurrency(e.target.value)}
              >
                {Array.from(
                  new Set(
                    [cur, 'USD', 'EUR', 'GBP', fCurrency || ''].filter(
                      Boolean,
                    ),
                  ),
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <MultiSelect
              label="project status"
              m={{
                all: [
                  { id: 'active', label: 'Active' },
                  { id: 'archived', label: 'Archived' },
                ],
                ids: fPStatus,
              }}
              onChange={setFPStatus}
            />
            <MultiSelect
              label="project type"
              m={{
                all: [
                  { id: 'TM', label: 'Time and materials' },
                  { id: 'FIXED_FEE', label: 'Fixed fee' },
                  { id: 'NON_BILLABLE', label: 'Non-billable' },
                ],
                ids: fPType,
              }}
              onChange={setFPType}
            />
            <MultiSelect
              label="project manager"
              m={{
                all: (filters?.projectManagers ?? []).map((m) => ({
                  id: m.userId,
                  label: m.label,
                })),
                ids: fManagers,
              }}
              onChange={setFManagers}
            />
          </div>
          {pLoad ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : pErrMsg ? (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {pErrMsg}
            </div>
          ) : profitR ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/80 bg-white p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Company profit over the period (
                    {profitR.range.currency})
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">Tracked time and expenses</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Scale: max of (revenue + costs) per month = {money(
                    profitR.range.currency,
                    chartMax,
                  )}{' '}
                  in this view
                </p>
                <div className="mt-3">
                  <div
                    className="flex h-44 min-h-[11rem] items-stretch justify-center gap-2 sm:gap-3 border-b border-slate-200 bg-slate-50/50 px-1"
                    aria-label="Revenue and costs by month"
                  >
                    {profitR.series.map((m) => {
                      const tot = m.revenue + m.costs
                      const colScale =
                        chartMax > 0 ? (tot / chartMax) * 100 : 0
                      const hasStack = tot > 0
                      return (
                        <div
                          key={m.month}
                          className="flex min-w-0 max-w-full flex-1 flex-col"
                        >
                          <div className="relative h-40 min-h-0 w-full flex-1">
                            {hasStack ? (
                              <div
                                className="absolute bottom-0 left-1/2 z-[1] flex w-9 max-w-full -translate-x-1/2 flex-col justify-end"
                                style={{
                                  height: `${colScale}%`,
                                }}
                                title={
                                  m.revenue > 0
                                    ? `Revenue: ${m.revenue.toFixed(2)}; Costs: ${m.costs.toFixed(2)}`
                                    : `Costs: ${m.costs.toFixed(2)}`
                                }
                              >
                                {m.revenue > 0 ? (
                                  <div
                                    className="w-full min-h-px flex-shrink-0 overflow-hidden rounded-t-sm border border-emerald-200/60 bg-emerald-500/90"
                                    style={
                                      {
                                        height: tot > 0
                                          ? `${(m.revenue / tot) * 100}%`
                                          : 0,
                                      } satisfies CSSProperties
                                    }
                                  />
                                ) : null}
                                {m.costs > 0 ? (
                                  <div
                                    className="w-full min-h-px flex-shrink-0 overflow-hidden rounded-b-sm border border-rose-200/60 bg-rose-300/90"
                                    style={
                                      {
                                        height: tot > 0
                                          ? `${(m.costs / tot) * 100}%`
                                          : 0,
                                      } satisfies CSSProperties
                                    }
                                  />
                                ) : null}
                              </div>
                            ) : (
                              <div
                                className="absolute bottom-0 left-1/2 h-0.5 w-9 -translate-x-1/2 rounded-sm bg-slate-200/90"
                                title="No data"
                              />
                            )}
                          </div>
                          <div className="pt-1.5 text-center text-[10px] leading-tight text-muted-foreground sm:text-xs">
                            {m.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-3 border border-emerald-200/60 bg-emerald-500/90"
                      aria-hidden
                    />
                    Revenue
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-3 border border-rose-200/60 bg-rose-300/90"
                      aria-hidden
                    />
                    Costs
                  </span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/80 bg-white p-3">
                  <h3 className="text-xs font-medium text-emerald-800">Revenue</h3>
                  <p className="mt-1 text-xl font-semibold">
                    {money(
                      profitR.range.currency,
                      profitR.summary.revenue.total,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Invoiced {money(profitR.range.currency, profitR.summary.revenue.invoiced)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uninvoiced {money(profitR.range.currency, profitR.summary.revenue.uninvoiced)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-white p-3">
                  <h3 className="text-xs font-medium text-rose-800">Cost</h3>
                  <p className="mt-1 text-xl font-semibold">
                    {money(profitR.range.currency, profitR.summary.costs.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From time (cost rates){' '}
                    {money(profitR.range.currency, profitR.summary.costs.fromTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expenses{' '}
                    {money(
                      profitR.range.currency,
                      profitR.summary.costs.fromExpenses,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-white p-3">
                  <h3 className="text-xs font-medium text-primary">Profit</h3>
                  <p className="mt-1 text-xl font-semibold text-primary">
                    {money(profitR.range.currency, profitR.summary.profit.amount)}
                    <span className="ms-1 text-sm font-medium text-slate-600">
                      {profitR.summary.profit.marginPercent.toFixed(0)}%
                    </span>
                  </p>
                </div>
              </div>
              <div className="space-y-2" id="profit-table-print">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <SubTabs
                    value={profitGroup}
                    onChange={setProfitGroup}
                    ids={[
                      { id: 'clients', label: 'Clients' },
                      { id: 'projects', label: 'Projects' },
                      { id: 'team', label: 'Team' },
                      { id: 'tasks', label: 'Tasks' },
                    ]}
                  />
                  <div className="relative">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setProfitExportOpen((e) => !e)}
                    >
                      Export <ChevronsDown className="ms-1 size-3.5" />
                    </Button>
                    {profitExportOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-40 rounded border border-border bg-white py-1 text-sm shadow-md">
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left hover:bg-muted/30"
                          onClick={() => {
                            exportProfitabilityCsv(
                              profitR,
                              profitGroup,
                              `profit-${profitGroup}`,
                            )
                            setProfitExportOpen(false)
                          }}
                        >
                          Excel (CSV)
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left hover:bg-muted/30"
                          onClick={() => {
                            void exportProfitabilityPdf(
                              profitR,
                              profitGroup,
                              `profit-${profitGroup}`,
                            ).then(() => setProfitExportOpen(false))
                          }}
                        >
                          PDF
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/80">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/90">
                        <th className="p-2 font-medium">Name</th>
                        {profitGroup === 'projects' && (
                          <th className="p-2 font-medium">Client</th>
                        )}
                        <th className="p-2 font-medium">Revenue</th>
                        <th className="p-2 font-medium">Cost</th>
                        <th className="p-2 font-medium">Profit</th>
                        <th className="p-2 font-medium">Return on cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitR.rows.map((r) => (
                        <tr key={r.id + r.name} className="border-b border-border/60">
                          <td className="p-2">
                            {r.name}
                            {r.subLabel ? (
                              <span className="block text-xs text-muted-foreground">
                                {r.subLabel}
                              </span>
                            ) : null}
                          </td>
                          {profitGroup === 'projects' && (
                            <td className="p-2 text-primary/80">
                              {r.clientName ?? '—'}
                            </td>
                          )}
                          <td className="p-2 tabular-nums">
                            {money(profitR.range.currency, r.revenue)}
                          </td>
                          <td className="p-2 tabular-nums text-rose-800">
                            {money(profitR.range.currency, r.cost)}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <span className="tabular-nums">
                                {money(profitR.range.currency, r.profit)}
                              </span>
                              {profitBar(r.profitBarShare)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Margin {r.marginPercent.toFixed(0)}% of revenue
                            </span>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {r.returnOnCostPercent == null
                              ? '—'
                              : `${r.returnOnCostPercent.toFixed(0)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/90 bg-slate-50/80 font-medium">
                        <td className="p-2">Total</td>
                        {profitGroup === 'projects' && <td className="p-2" />}
                        <td className="p-2">
                          {money(
                            profitR.range.currency,
                            profitR.totals.revenue,
                          )}
                        </td>
                        <td className="p-2">
                          {money(profitR.range.currency, profitR.totals.cost)}
                        </td>
                        <td className="p-2">
                          {money(profitR.range.currency, profitR.totals.profit)}
                        </td>
                        <td className="p-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
