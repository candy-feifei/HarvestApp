import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchOrganizationContext } from '@/features/clients/api'
import {
  archiveTeamMember,
  getTeamWeeklySummary,
  removeTeamMember,
  resendTeamInvitation,
  updateTeamMember,
  type TeamWeeklySummaryItem,
} from '@/features/team/api'
import { TeamRolesPanel } from '@/features/team/components/team-roles-panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Clock, Pin, UserPlus } from 'lucide-react'

const tabBase =
  'inline-flex h-9 min-w-0 items-center border-b-2 px-1 pb-0.5 text-sm font-medium transition-colors'

type TabId = 'members' | 'roles'

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function utcDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((p) => parseInt(p, 10))
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

function startOfIsoWeekFromUtcDate(ref: Date): Date {
  const w = ref.getUTCDay()
  const add = w === 0 ? -6 : 1 - w
  return new Date(
    Date.UTC(
      ref.getUTCFullYear(),
      ref.getUTCMonth(),
      ref.getUTCDate() + add,
      0,
      0,
      0,
      0,
    ),
  )
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + n,
      0,
      0,
      0,
      0,
    ),
  )
}

function formatWeekRange(weekOf: string): string {
  const from = utcDayStart(weekOf)
  const to = addUtcDays(from, 6)
  const y = from.getUTCFullYear()
  const d1 = from.getUTCDate()
  const m2 = to.getUTCMonth() + 1
  const d2 = to.getUTCDate()
  return `This week ${d1} – ${d2} ${m2} ${y}`
}

function initials(first: string, last: string) {
  const a = (first.trim()[0] ?? '').toUpperCase()
  const b = (last.trim()[0] ?? '').toUpperCase()
  return `${a}${b}` || '?'
}

function hoursFmt(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2)
}

const noTeamManagePermTitle =
  'Only administrators and managers can pin, archive, or delete team members.'

function ActionsMenu({
  onEdit,
  onPinToggle,
  pinned,
  canManageTeam,
  isBusy,
  onArchive,
  onDelete,
  onOpenChange,
}: {
  onEdit: () => void
  onPinToggle: () => void
  pinned: boolean
  canManageTeam: boolean
  isBusy?: boolean
  onArchive: () => void
  onDelete: () => void
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative inline-flex justify-end" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        className="h-8 border-border px-2 text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={isBusy}
        onClick={() => setOpen((v) => !v)}
      >
        {isBusy ? '…' : 'Actions'}
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-9 z-50 w-40 rounded-md border border-border bg-white shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            title={!canManageTeam ? noTeamManagePermTitle : undefined}
            disabled={!canManageTeam}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (!canManageTeam) return
              setOpen(false)
              onPinToggle()
            }}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            title={!canManageTeam ? noTeamManagePermTitle : undefined}
            disabled={!canManageTeam}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (!canManageTeam) return
              setOpen(false)
              onArchive()
            }}
          >
            Archive
          </button>
          <button
            type="button"
            role="menuitem"
            title={!canManageTeam ? noTeamManagePermTitle : undefined}
            disabled={!canManageTeam}
            className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (!canManageTeam) return
              setOpen(false)
              onDelete()
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

function InviteStatus({
  s,
  onResend,
}: {
  s: string
  onResend: () => void
}) {
  if (s !== 'INVITED') return null
  return (
    <span className="text-xs text-muted-foreground">
      Hasn&apos;t signed in yet.{' '}
      <button
        type="button"
        className="text-primary underline-offset-2 hover:underline"
        onClick={onResend}
      >
        Resend invitation
      </button>
    </span>
  )
}

const memberListGridClass =
  'grid grid-cols-[1.5rem_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] items-center gap-2 border-b border-border/80 px-3 py-2.5 text-sm sm:px-4'

const memberListHeaderGridClass =
  'grid grid-cols-[1.5rem_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4'

function MemberListRow({
  m,
  showLeftPin,
  onEditMember,
  canManageTeam,
  onPinToggle,
  onArchiveMember,
  onDeleteMember,
  isRowActionPending,
}: {
  m: TeamWeeklySummaryItem
  showLeftPin: boolean
  onEditMember: (id: string) => void
  canManageTeam: boolean
  onPinToggle: (id: string, next: boolean) => void
  onArchiveMember: (id: string) => void
  onDeleteMember: (id: string) => void
  isRowActionPending: boolean
}) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const pinned = Boolean(m.isPinned)
  return (
    <div
      className={cn(
        memberListGridClass,
        'last:border-b-0',
        actionMenuOpen && 'relative z-40 bg-white',
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center pr-0.5">
        {showLeftPin && pinned ? (
          <Pin className="size-3.5 shrink-0 text-foreground" aria-label="Pinned" />
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          {initials(m.firstName, m.lastName)}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">
            {m.firstName} {m.lastName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {m.email}{' '}
            <InviteStatus
              s={m.invitationStatus}
              onResend={() => {
                void resendTeamInvitation(m.memberId)
              }}
            />
          </div>
        </div>
      </div>
      <span className="tabular-nums text-foreground">{hoursFmt(m.hours)}</span>
      <span className="tabular-nums text-foreground">
        {Math.round(m.utilizationPercent)}%
      </span>
      <span className="tabular-nums text-muted-foreground">
        {hoursFmt(m.weeklyCapacity)}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {hoursFmt(m.billableHours)}
      </span>
      <div className="text-right">
        <ActionsMenu
          onEdit={() => onEditMember(m.memberId)}
          onPinToggle={() => onPinToggle(m.memberId, !pinned)}
          pinned={pinned}
          canManageTeam={canManageTeam}
          isBusy={isRowActionPending}
          onArchive={() => onArchiveMember(m.memberId)}
          onDelete={() => onDeleteMember(m.memberId)}
          onOpenChange={setActionMenuOpen}
        />
      </div>
    </div>
  )
}

function MembersPanel({
  items,
  weekOf,
  onPrevWeek,
  onNextWeek,
  onEditMember,
  onPinToggle,
  onArchiveMember,
  onDeleteMember,
  canManageTeam,
  rowActionPendingMemberId,
  loading,
  isError,
}: {
  items: TeamWeeklySummaryItem[] | undefined
  weekOf: string
  onPrevWeek: () => void
  onNextWeek: () => void
  onEditMember: (memberId: string) => void
  onPinToggle: (memberId: string, nextPinned: boolean) => void
  onArchiveMember: (memberId: string) => void
  onDeleteMember: (memberId: string) => void
  canManageTeam: boolean
  rowActionPendingMemberId: string | null
  loading: boolean
  isError: boolean
}) {
  const rows = items ?? []
  const pinnedRows = rows.filter((r) => Boolean(r.isPinned))
  const employeeRows = rows.filter((r) => !r.isPinned)
  if (loading) {
    return (
      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        Loading team...
      </p>
    )
  }
  if (isError) {
    return (
      <p className="mt-6 text-sm text-destructive" role="alert">
        Failed to load team. Please check your network or sign in again.
      </p>
    )
  }
  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  const billableHours = rows.reduce((s, r) => s + r.billableHours, 0)
  const nonBillableHours = totalHours - billableHours
  const teamCapacity = rows.reduce((s, r) => s + r.weeklyCapacity, 0)
  const billablePct = totalHours > 0 ? (billableHours / totalHours) * 100 : 0
  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onPrevWeek}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-white text-foreground hover:bg-muted/40"
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="min-w-0">{formatWeekRange(weekOf)}</span>
          <button
            type="button"
            onClick={onNextWeek}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-white text-foreground hover:bg-muted/40"
            aria-label="Next week"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            asChild
            className="h-9 w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            <Link to="/team/invite">
              <UserPlus className="size-4" strokeWidth={2.25} aria-hidden />
              Invite person
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total hours</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            {hoursFmt(totalHours)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">
            Team capacity
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            {hoursFmt(teamCapacity)}
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-md border border-border bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-sm bg-blue-600" />
            <span className="text-muted-foreground">Billable</span>
            <span className="font-medium text-foreground">
              {hoursFmt(billableHours)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-sm bg-blue-200" />
            <span className="text-muted-foreground">Non-billable</span>
            <span className="font-medium text-foreground">
              {hoursFmt(nonBillableHours)}
            </span>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-blue-600"
            style={{ width: `${Math.min(100, Math.max(0, billablePct))}%` }}
            aria-hidden
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-border bg-white shadow-sm">
          <p className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
            No team members yet. Click &quot;Invite person&quot; to send an
            invitation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pinnedRows.length > 0 ? (
            <div className="rounded-md border border-border bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5 text-xs font-medium text-foreground sm:px-4">
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                Pinned employees ({pinnedRows.length})
              </div>
              <div className={memberListHeaderGridClass}>
                <span />
                <span>Team member</span>
                <span>Hours</span>
                <span>Utilization</span>
                <span>Capacity</span>
                <span>Billable hours</span>
                <span className="text-right">Actions</span>
              </div>
              {pinnedRows.map((m) => (
                <MemberListRow
                  key={m.memberId}
                  m={m}
                  showLeftPin
                  onEditMember={onEditMember}
                  canManageTeam={canManageTeam}
                  onPinToggle={onPinToggle}
                  onArchiveMember={onArchiveMember}
                  onDeleteMember={onDeleteMember}
                  isRowActionPending={rowActionPendingMemberId === m.memberId}
                />
              ))}
            </div>
          ) : null}
          <div className="rounded-md border border-border bg-white shadow-sm">
            <div className="border-b border-border bg-muted/40 px-3 py-2.5 text-xs font-medium text-foreground sm:px-4">
              Employees ({employeeRows.length})
            </div>
            <div className={memberListHeaderGridClass}>
              <span />
              <span>Team member</span>
              <span>Hours</span>
              <span>Utilization</span>
              <span>Capacity</span>
              <span>Billable hours</span>
              <span className="text-right">Actions</span>
            </div>
            {employeeRows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground sm:px-4">
                No other team members. Use Pin in Actions to add people to the
                pinned list above.
              </p>
            ) : (
              employeeRows.map((m) => (
                <MemberListRow
                  key={m.memberId}
                  m={m}
                  showLeftPin={false}
                  onEditMember={onEditMember}
                  canManageTeam={canManageTeam}
                  onPinToggle={onPinToggle}
                  onArchiveMember={onArchiveMember}
                  onDeleteMember={onDeleteMember}
                  isRowActionPending={rowActionPendingMemberId === m.memberId}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type TeamLocationState = {
  invited?: boolean
  setPasswordUrl?: string
} | null

export function TeamPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>(() =>
    searchParams.get('tab') === 'roles' ? 'roles' : 'members',
  )
  const [weekOf, setWeekOf] = useState(() =>
    toYmd(
      startOfIsoWeekFromUtcDate(
        new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        ),
      ),
    ),
  )
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'roles') setTab('roles')
    else setTab('members')
  }, [searchParams])
  const qc = useQueryClient()
  const inviteState = (location.state as TeamLocationState) ?? null
  const orgCtxQ = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })
  const ctxRole = orgCtxQ.data?.systemRole?.toUpperCase() ?? ''
  const canManageTeam =
    ctxRole === 'ADMINISTRATOR' || ctxRole === 'MANAGER'
  const q = useQuery({
    queryKey: ['team', 'weekly', weekOf],
    queryFn: () => getTeamWeeklySummary(weekOf),
  })
  const pinMut = useMutation({
    mutationFn: (args: { memberId: string; isPinned: boolean }) =>
      updateTeamMember(args.memberId, { isPinned: args.isPinned }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'weekly'] })
    },
  })
  const archiveMut = useMutation({
    mutationFn: (memberId: string) => archiveTeamMember(memberId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'weekly'] })
    },
  })
  const deleteMut = useMutation({
    mutationFn: (memberId: string) => removeTeamMember(memberId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'weekly'] })
    },
  })
  const rowActionPendingMemberId =
    (pinMut.isPending && pinMut.variables?.memberId)
    || (archiveMut.isPending && archiveMut.variables)
    || (deleteMut.isPending && deleteMut.variables)
    || null

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
      {inviteState?.invited ? (
        <div className="mb-4 space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
          <p>
            Invitation processed. If outbound email is configured, they will receive a message.
          </p>
          {import.meta.env.DEV && inviteState.setPasswordUrl ? (
            <p className="text-xs break-all text-muted-foreground">
              Dev only: password setup URL {inviteState.setPasswordUrl}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage people, roles, and weekly capacity for your team.
          </p>
        </div>
        {tab === 'roles' && canManageTeam ? (
          <Button
            type="button"
            className="h-9 w-full shrink-0 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 sm:mt-0.5 sm:w-auto"
            asChild
          >
            <Link to="/team/roles/new">+ New role</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-6 border-b border-border">
        <nav
          className="flex flex-wrap gap-6"
          role="tablist"
          aria-label="Team sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'members'}
            onClick={() => {
              setSearchParams(
                (prev) => {
                  const p = new URLSearchParams(prev)
                  p.delete('tab')
                  return p
                },
                { replace: true },
              )
            }}
            className={cn(
              tabBase,
              tab === 'members'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Members
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'roles'}
            onClick={() => {
              setSearchParams(
                (prev) => {
                  const p = new URLSearchParams(prev)
                  p.set('tab', 'roles')
                  return p
                },
                { replace: true },
              )
            }}
            className={cn(
              tabBase,
              tab === 'roles'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Roles
          </button>
        </nav>
      </div>

      {tab === 'members' ? (
        <>
          {archiveMut.isError || deleteMut.isError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              Could not complete that action. You may not have permission, or the
              server rejected the request.
            </p>
          ) : null}
          <MembersPanel
            items={q.data?.items}
            weekOf={q.data?.range.weekOf ?? weekOf}
            onPrevWeek={() => {
              const d = utcDayStart(weekOf)
              const prev = addUtcDays(d, -7)
              setWeekOf(toYmd(startOfIsoWeekFromUtcDate(prev)))
            }}
            onNextWeek={() => {
              const d = utcDayStart(weekOf)
              const next = addUtcDays(d, 7)
              setWeekOf(toYmd(startOfIsoWeekFromUtcDate(next)))
            }}
            onEditMember={(memberId) => navigate(`/team/members/${memberId}/edit`)}
            onPinToggle={(memberId, nextPinned) => {
              pinMut.mutate({ memberId, isPinned: nextPinned })
            }}
            onArchiveMember={(memberId) => {
              if (
                !window.confirm(
                  'Archive this person? They will be removed from the team list, but their past time and data stay in the account. You can invite them again later if needed (depending on your workflow).',
                )
              ) {
                return
              }
              archiveMut.mutate(memberId)
            }}
            onDeleteMember={(memberId) => {
              if (
                !window.confirm(
                  'Permanently remove this person from the account? They will lose project access, assignments, and rate history here. This cannot be undone. Historical time they logged may still be visible in reports.',
                )
              ) {
                return
              }
              deleteMut.mutate(memberId)
            }}
            canManageTeam={canManageTeam}
            rowActionPendingMemberId={rowActionPendingMemberId}
            loading={q.isLoading}
            isError={q.isError}
          />
        </>
      ) : (
        <TeamRolesPanel canManage={canManageTeam} />
      )}
    </div>
  )
}
