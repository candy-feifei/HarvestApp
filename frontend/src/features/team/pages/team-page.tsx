import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getTeamWeeklySummary, resendTeamInvitation, type TeamWeeklySummaryItem } from '@/features/team/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'

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

function ActionsMenu({
  onEdit,
  onPin,
  onArchive,
  onDelete,
}: {
  onEdit: () => void
  onPin: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

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
        onClick={() => setOpen((v) => !v)}
      >
        Actions
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-md border border-border bg-white shadow-md"
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
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => {
              setOpen(false)
              onPin()
            }}
          >
            Pin
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
            onClick={() => {
              setOpen(false)
              onArchive()
            }}
          >
            Archive
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/5"
            onClick={() => {
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

function MembersPanel({
  items,
  weekOf,
  onPrevWeek,
  onNextWeek,
  onEditMember,
  loading,
  isError,
}: {
  items: TeamWeeklySummaryItem[] | undefined
  weekOf: string
  onPrevWeek: () => void
  onNextWeek: () => void
  onEditMember: (memberId: string) => void
  loading: boolean
  isError: boolean
}) {
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
  const rows = items ?? []
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

      <div className="rounded-md border border-border bg-white shadow-sm">
        <div className="grid grid-cols-[1.2fr_.7fr_.7fr_.7fr_.7fr_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
          <span>Employees ({rows.length})</span>
          <span>Hours</span>
          <span>Utilization</span>
          <span>Capacity</span>
          <span>Billable hours</span>
          <span className="text-right">Actions</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
            No team members yet. Click "Invite person" to send an invitation.
          </p>
        ) : (
          rows.map((m) => (
            <div
              key={m.memberId}
              className="grid grid-cols-[1.2fr_.7fr_.7fr_.7fr_.7fr_auto] items-center gap-2 border-b border-border/80 px-3 py-2.5 text-sm last:border-b-0 sm:px-4"
            >
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
              <span className="tabular-nums text-foreground">
                {hoursFmt(m.hours)}
              </span>
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
                  onPin={() => window.alert('Pin: not wired up yet.')}
                  onArchive={() => window.alert('Archive: not wired up yet.')}
                  onDelete={() => window.alert('Delete: not wired up yet.')}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

type TeamLocationState = {
  invited?: boolean
  setPasswordUrl?: string
} | null

export function TeamPage() {
  const [tab, setTab] = useState<TabId>('members')
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
  const inviteState = (location.state as TeamLocationState) ?? null
  const q = useQuery({
    queryKey: ['team', 'weekly', weekOf],
    queryFn: () => getTeamWeeklySummary(weekOf),
  })

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
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Team
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage people, roles, and weekly capacity for your team.
      </p>

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
            onClick={() => setTab('members')}
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
            onClick={() => setTab('roles')}
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
          loading={q.isLoading}
          isError={q.isError}
        />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Roles and permissions will be configured here in a future update. For now, use Members to invite people.
        </p>
      )}
    </div>
  )
}
