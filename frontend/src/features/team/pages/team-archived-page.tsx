import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchOrganizationContext } from '@/features/clients/api'
import {
  listArchivedTeamMembers,
  removeTeamMember,
  restoreTeamMember,
} from '@/features/team/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function money(n: number) {
  if (n === 0) return '—'
  return `$${n.toFixed(2)}`
}

export function TeamArchivedPage() {
  const qc = useQueryClient()
  const orgCtxQ = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })
  const ctxRole = orgCtxQ.data?.systemRole?.toUpperCase() ?? ''
  const canManageTeam =
    ctxRole === 'ADMINISTRATOR' || ctxRole === 'MANAGER'

  const q = useQuery({
    queryKey: ['team', 'archived'],
    queryFn: listArchivedTeamMembers,
  })

  const restoreMut = useMutation({
    mutationFn: (memberId: string) => restoreTeamMember(memberId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'archived'] })
      await qc.invalidateQueries({ queryKey: ['team', 'weekly'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (memberId: string) => removeTeamMember(memberId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'archived'] })
    },
  })

  const items = q.data?.items ?? []
  const busyId =
    (restoreMut.isPending && restoreMut.variables) ||
    (deleteMut.isPending && deleteMut.variables) ||
    null

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
      <Button
        type="button"
        variant="ghost"
        className="h-9 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        asChild
      >
        <Link to="/team">← Back to Team</Link>
      </Button>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        Archived people
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Team members you&apos;ve archived no longer appear on the main Team
        list. You can restore them or permanently delete them from the account.
      </p>

      {q.isError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Could not load archived people.
        </p>
      ) : null}
      {restoreMut.isError || deleteMut.isError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Could not complete that action. You may not have permission, or the
          server rejected the request.
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-md border border-border bg-white shadow-sm">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              <th className="w-[100px] px-3 py-2.5 sm:px-4" />
              <th className="px-3 py-2.5 sm:px-4">Employees</th>
              <th className="px-3 py-2.5 sm:px-4">Default billable rate</th>
              <th className="px-3 py-2.5 sm:px-4">Cost rate</th>
              <th className="w-[100px] px-3 py-2.5 text-right sm:px-4" />
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground sm:px-4"
                >
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground sm:px-4"
                >
                  No archived people. Archive someone from the Team list to
                  see them here.
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <tr
                  key={m.memberId}
                  className="border-b border-border/80 last:border-b-0"
                >
                  <td className="px-3 py-2.5 align-middle sm:px-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-border px-2 text-xs"
                      disabled={!canManageTeam || busyId === m.memberId}
                      onClick={() => {
                        if (!canManageTeam) return
                        restoreMut.mutate(m.memberId)
                      }}
                    >
                      {restoreMut.isPending && restoreMut.variables === m.memberId
                        ? '…'
                        : 'Restore'}
                    </Button>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground sm:px-4">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4">
                    {money(m.defaultBillableRatePerHour)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4">
                    {money(m.costRatePerHour)}
                  </td>
                  <td className="px-3 py-2.5 text-right sm:px-4">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-8 border-destructive/50 px-2 text-xs text-destructive',
                        'hover:bg-destructive/5',
                      )}
                      disabled={!canManageTeam || busyId === m.memberId}
                      onClick={() => {
                        if (!canManageTeam) return
                        if (
                          !window.confirm(
                            'Permanently remove this person from the account? Their membership and rate history here will be deleted. This cannot be undone. Historical time they logged may still appear in reports.',
                          )
                        ) {
                          return
                        }
                        deleteMut.mutate(m.memberId)
                      }}
                    >
                      {deleteMut.isPending && deleteMut.variables === m.memberId
                        ? '…'
                        : 'Delete'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
