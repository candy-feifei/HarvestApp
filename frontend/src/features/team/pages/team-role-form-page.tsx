import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { fetchOrganizationContext } from '@/features/clients/api'
import {
  createTeamRole,
  listTeamMembers,
  listTeamRoles,
  updateTeamRole,
  type TeamMemberRow,
} from '@/features/team/api'
import { ApiError } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inputCls } from '@/features/clients/client-form-helpers'

const formPanelCls =
  'rounded-lg border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm sm:p-6'
const cbCls = 'size-4 accent-orange-500'

function initials(first: string, last: string) {
  const a = (first.trim()[0] ?? '').toUpperCase()
  const b = (last.trim()[0] ?? '').toUpperCase()
  return `${a}${b}` || '?'
}

function membersMatchQuery(m: TeamMemberRow, q: string) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const name = `${m.firstName} ${m.lastName}`.toLowerCase()
  return (
    name.includes(s) ||
    m.email.toLowerCase().includes(s) ||
    m.firstName.toLowerCase().includes(s) ||
    m.lastName.toLowerCase().includes(s)
  )
}

const teamRolesTab = '/team?tab=roles'

export function TeamRoleFormPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const qc = useQueryClient()
  const params = useParams<{ roleId: string }>()
  const isNew = pathname === '/team/roles/new' || pathname.endsWith('/team/roles/new')
  const roleId = isNew ? undefined : params.roleId

  const [roleName, setRoleName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [userSearch, setUserSearch] = useState('')

  const orgCtxQ = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })
  const ctxRole = orgCtxQ.data?.systemRole?.toUpperCase() ?? ''
  const canManage = ctxRole === 'ADMINISTRATOR' || ctxRole === 'MANAGER'

  const membersQ = useQuery({
    queryKey: ['team', 'members', 'roster'],
    queryFn: listTeamMembers,
  })
  const rolesQ = useQuery({
    queryKey: ['team', 'roles'],
    queryFn: listTeamRoles,
    enabled: Boolean(!isNew && roleId),
  })

  const members = membersQ.data?.items ?? []
  const filteredMembers = useMemo(
    () => members.filter((m) => membersMatchQuery(m, userSearch)),
    [members, userSearch],
  )

  const existing = useMemo(() => {
    if (isNew || !roleId) return undefined
    return rolesQ.data?.items.find((r) => r.id === roleId)
  }, [isNew, roleId, rolesQ.data?.items])

  useEffect(() => {
    if (isNew || !existing) return
    setRoleName(existing.name)
    setSelectedMemberIds(new Set(existing.members.map((m) => m.memberId)))
  }, [isNew, existing])

  const createMut = useMutation({
    mutationFn: createTeamRole,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'roles'] })
      navigate(teamRolesTab, { replace: true })
    },
  })

  const updateMut = useMutation({
    mutationFn: (args: { id: string; body: Parameters<typeof updateTeamRole>[1] }) =>
      updateTeamRole(args.id, args.body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'roles'] })
      navigate(teamRolesTab, { replace: true })
    },
  })

  const saving = createMut.isPending || updateMut.isPending
  const err =
    (createMut.isError && createMut.error) ||
    (updateMut.isError && updateMut.error) ||
    null
  const saveErrorMessage =
    err instanceof ApiError
      ? err.message
      : err
        ? 'Could not save role. Try again.'
        : null

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const onSave = () => {
    const name = roleName.trim()
    if (!name) return
    const ids = [...selectedMemberIds]
    if (isNew) {
      createMut.mutate({
        name,
        memberUserOrganizationIds: ids.length ? ids : undefined,
      })
    } else if (roleId) {
      updateMut.mutate({
        id: roleId,
        body: {
          name,
          memberUserOrganizationIds: ids,
        },
      })
    }
  }

  const onCancel = () => {
    navigate(teamRolesTab)
  }

  if (orgCtxQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4">
        <p className="text-sm text-muted-foreground">
          Only administrators and managers can add or edit custom roles.
        </p>
        <Link
          to={teamRolesTab}
          className="mt-4 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Back to Team
        </Link>
      </div>
    )
  }

  if (!isNew && roleId && rolesQ.isSuccess && !existing) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4">
        <p className="text-sm text-destructive" role="alert">
          This role was not found.
        </p>
        <Link
          to={teamRolesTab}
          className="mt-4 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Back to Team
        </Link>
      </div>
    )
  }

  if (!isNew && roleId && (rolesQ.isLoading || rolesQ.isError)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {rolesQ.isError ? 'Could not load this role.' : 'Loading…'}
        </p>
        {rolesQ.isError ? (
          <Link
            to={teamRolesTab}
            className="mt-4 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Back to Team
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4">
      <p className="text-sm text-muted-foreground">
        <Link
          to={teamRolesTab}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Back to Team
        </Link>
        <span className="text-muted-foreground"> · Roles</span>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {isNew ? 'New role' : 'Edit role'}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isNew
          ? 'Name the role and choose who it applies to. You can change this later.'
          : 'Update the role name or who is assigned.'}
      </p>

      <div className={cn('mt-8', formPanelCls)}>
        <div className="space-y-4">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-foreground"
              htmlFor="role-name-input"
            >
              Role name
            </label>
            <input
              id="role-name-input"
              className={cn(inputCls, 'h-10')}
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Design, Development, Marketing, etc."
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">
              Who&apos;s assigned to this role?
            </p>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                className={cn(inputCls, 'h-10 w-full pl-9')}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users…"
                aria-label="Search users to assign to this role"
              />
            </div>
            <div className="mt-2 overflow-hidden rounded-md border border-amber-200/90 bg-white">
              <div className="max-h-64 divide-y divide-border/80 overflow-auto">
                {membersQ.isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading team…</p>
                ) : membersQ.isError ? (
                  <p className="p-3 text-sm text-destructive">
                    Could not load team members.
                  </p>
                ) : members.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No team members to assign.
                  </p>
                ) : filteredMembers.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No users match that search.
                  </p>
                ) : (
                  filteredMembers.map((m) => (
                    <label
                      key={m.memberId}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className={cbCls}
                        checked={selectedMemberIds.has(m.memberId)}
                        onChange={() => toggleMember(m.memberId)}
                      />
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                        {initials(m.firstName, m.lastName)}
                      </div>
                      <span className="font-medium text-foreground">
                        {m.firstName} {m.lastName}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          {saveErrorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {saveErrorMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving || !roleName.trim()}
              onClick={() => onSave()}
            >
              {saving ? '…' : 'Save role'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-white"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
