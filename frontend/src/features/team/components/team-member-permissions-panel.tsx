import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  updateTeamMember,
  type ManagerPermissions,
  type SystemRoleName,
  type TeamMemberDetail,
} from '@/features/team/api'

const DEFAULT_MGR: ManagerPermissions = {
  createEditManagedProjects: false,
  createEditAllClientsTasks: false,
  createEditTimeExpensesManaged: false,
  seeEditBillableRatesManaged: false,
  createEditDraftInvoices: false,
  manageAllInvoices: false,
  createEditAllEstimates: false,
  withdrawApprovals: false,
}

const MGR_CHECKBOXES: { key: keyof ManagerPermissions; label: string }[] = [
  {
    key: 'createEditManagedProjects',
    label:
      'Create projects, and edit projects that they manage',
  },
  {
    key: 'createEditAllClientsTasks',
    label: 'Create and edit all clients and tasks on the account',
  },
  {
    key: 'createEditTimeExpensesManaged',
    label:
      'Create and edit time and expenses for people and projects they manage',
  },
  {
    key: 'seeEditBillableRatesManaged',
    label:
      'See and edit billable rates and amounts for projects and people they manage',
  },
  {
    key: 'createEditDraftInvoices',
    label: 'Create and edit draft invoices for projects they manage',
  },
  {
    key: 'manageAllInvoices',
    label:
      'Send and fully manage all invoices for projects they manage (record payments, edit non-drafts, send reminders and thank-yous, delete, etc)',
  },
  {
    key: 'createEditAllEstimates',
    label: 'Create and edit all estimates on the account',
  },
  {
    key: 'withdrawApprovals',
    label:
      'Withdraw approval for time and expenses of people and projects they manage',
  },
]

function parseSystemRole(s: string): SystemRoleName {
  if (s === 'MANAGER' || s === 'ADMINISTRATOR' || s === 'MEMBER') return s
  return 'MEMBER'
}

function mergeManagerPerms(
  p: TeamMemberDetail['managerPermissions'],
): ManagerPermissions {
  return { ...DEFAULT_MGR, ...p }
}

const radioCls = 'size-4 shrink-0 accent-orange-500'
const cbCls = 'mt-0.5 size-4 shrink-0 accent-orange-500'

type Props = {
  member: TeamMemberDetail
  canEdit: boolean
}

export function TeamMemberPermissionsPanel({ member, canEdit }: Props) {
  const qc = useQueryClient()
  const id = member.memberId

  const [localRole, setLocalRole] = useState<SystemRoleName>(
    () => parseSystemRole(member.systemRole),
  )
  const [localPerms, setLocalPerms] = useState<ManagerPermissions>(() =>
    mergeManagerPerms(member.managerPermissions),
  )
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setIsDirty(false)
  }, [id])

  useEffect(() => {
    if (isDirty) return
    setLocalRole(parseSystemRole(member.systemRole))
    setLocalPerms(mergeManagerPerms(member.managerPermissions))
  }, [member, isDirty])

  const sameAsServer = useMemo(() => {
    if (parseSystemRole(member.systemRole) !== localRole) return false
    if (localRole !== 'MANAGER') return true
    const s = mergeManagerPerms(member.managerPermissions)
    return MGR_CHECKBOXES.every((c) => localPerms[c.key] === s[c.key])
  }, [member, localRole, localPerms])

  const saveMut = useMutation({
    mutationFn: () => {
      const body: {
        systemRole: SystemRoleName
        managerPermissions?: ManagerPermissions
      } = { systemRole: localRole }
      if (localRole === 'MANAGER') {
        body.managerPermissions = { ...localPerms }
      }
      return updateTeamMember(id, body)
    },
    onSuccess: async () => {
      setIsDirty(false)
      await qc.invalidateQueries({ queryKey: ['team', 'member', id] })
      await qc.invalidateQueries({ queryKey: ['team', 'weekly'] })
    },
  })

  const onRoleChange = useCallback(
    (r: SystemRoleName) => {
      if (!canEdit) return
      setIsDirty(true)
      setLocalRole(r)
      if (r === 'MANAGER') {
        setLocalPerms(mergeManagerPerms(member.managerPermissions))
      } else {
        setLocalPerms({ ...DEFAULT_MGR })
      }
    },
    [canEdit, member.managerPermissions],
  )

  const setPerm = useCallback(
    (key: keyof ManagerPermissions, v: boolean) => {
      if (!canEdit || localRole !== 'MANAGER') return
      setIsDirty(true)
      setLocalPerms((prev) => ({ ...prev, [key]: v }))
    },
    [canEdit, localRole],
  )

  const reset = useCallback(() => {
    setLocalRole(parseSystemRole(member.systemRole))
    setLocalPerms(mergeManagerPerms(member.managerPermissions))
    setIsDirty(false)
  }, [member])

  const firstName = member.firstName
  const mgrOptionsEnabled = canEdit && localRole === 'MANAGER'

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {firstName}&apos;s permissions
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This setting determines what {firstName} can see and do in this
        account.
      </p>

      {!canEdit ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Only account administrators can change a person&apos;s system role
          and manager permissions.
        </p>
      ) : null}

      <div className="mt-6 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-[7rem_1fr]">
        <div
          className="text-sm font-medium text-foreground md:pt-0.5"
          id="perm-heading"
        >
          Permissions
        </div>
        <div
          className="min-w-0 space-y-6 pl-0 md:pl-2"
          role="group"
          aria-labelledby="perm-heading"
        >
          <label
            className={cn(
              'flex cursor-pointer items-start gap-2.5',
              !canEdit && 'cursor-default',
            )}
          >
            <input
              type="radio"
              name="system-role"
              className={radioCls}
              checked={localRole === 'MEMBER'}
              onChange={() => onRoleChange('MEMBER')}
              disabled={!canEdit}
            />
            <span className="min-w-0">
              <span className="text-sm font-medium text-foreground">
                Member
              </span>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Good for people who just need to track time and expenses.
              </p>
            </span>
          </label>

          <div>
            <label
              className={cn(
                'flex cursor-pointer items-start gap-2.5',
                !canEdit && 'cursor-default',
              )}
            >
              <input
                type="radio"
                name="system-role"
                className={radioCls}
                checked={localRole === 'MANAGER'}
                onChange={() => onRoleChange('MANAGER')}
                disabled={!canEdit}
              />
              <span className="min-w-0">
                <span className="text-sm font-medium text-foreground">
                  Manager
                </span>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Good for people who need more access to people and project
                  reports. Managers can approve and run reports for all time and
                  expenses tracked to selected projects and people. Optionally,
                  they can also:
                </p>
              </span>
            </label>
            <ul className="ml-2 mt-3 list-none space-y-2.5 border-l-2 border-border/80 pl-5 md:ml-7">
              {MGR_CHECKBOXES.map(({ key, label }) => (
                <li key={key} className="text-sm text-foreground">
                  <label
                    className={cn(
                      'flex items-start gap-2',
                      mgrOptionsEnabled
                        ? 'cursor-pointer'
                        : 'cursor-default text-muted-foreground',
                    )}
                  >
                    <input
                      type="checkbox"
                      className={cbCls}
                      checked={localPerms[key]}
                      onChange={(e) => setPerm(key, e.target.checked)}
                      disabled={!mgrOptionsEnabled}
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <label
            className={cn(
              'flex cursor-pointer items-start gap-2.5',
              !canEdit && 'cursor-default',
            )}
          >
            <input
              type="radio"
              name="system-role"
              className={radioCls}
              checked={localRole === 'ADMINISTRATOR'}
              onChange={() => onRoleChange('ADMINISTRATOR')}
              disabled={!canEdit}
            />
            <span className="min-w-0">
              <span className="text-sm font-medium text-foreground">
                Administrator
              </span>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Good for people who need the most control to manage your
                account. Administrators can see and do everything: create and
                manage all projects and people, manage and invoice all clients,
                see all reports, see and edit all rates, and more.
              </p>
            </span>
          </label>
        </div>
      </div>

      {canEdit ? (
        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 border-border sm:min-w-[7rem]"
            onClick={reset}
            disabled={!isDirty}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 bg-emerald-600 text-white hover:bg-emerald-600/90 sm:min-w-[10rem]"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || (sameAsServer && !isDirty)}
          >
            {saveMut.isPending ? 'Saving…' : 'Update permissions'}
          </Button>
        </div>
      ) : null}
      {saveMut.isError ? (
        <p className="mt-3 text-sm text-destructive">
          Could not save permissions.
        </p>
      ) : null}
    </div>
  )
}
