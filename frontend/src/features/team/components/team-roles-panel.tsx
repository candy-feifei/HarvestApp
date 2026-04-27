import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inputCls } from '@/features/clients/client-form-helpers'
import { ApiError } from '@/lib/api/http'
import { deleteTeamRole, listTeamRoles, type TeamCustomRole } from '@/features/team/api'

const cbCls = 'size-4 accent-orange-500'

function initials(first: string, last: string) {
  const a = (first.trim()[0] ?? '').toUpperCase()
  const b = (last.trim()[0] ?? '').toUpperCase()
  return `${a}${b}` || '?'
}

function roleMatchesQuery(r: TeamCustomRole, q: string) {
  if (!q.trim()) return true
  return r.name.toLowerCase().includes(q.trim().toLowerCase())
}

type Props = {
  canManage: boolean
}

export function TeamRolesPanel({ canManage }: Props) {
  const qc = useQueryClient()
  const [listSearch, setListSearch] = useState('')
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  )

  const rolesQ = useQuery({
    queryKey: ['team', 'roles'],
    queryFn: listTeamRoles,
  })

  const roles = rolesQ.data?.items ?? []
  const filteredRoles = useMemo(
    () => roles.filter((r) => roleMatchesQuery(r, listSearch)),
    [roles, listSearch],
  )

  const deleteMut = useMutation({
    mutationFn: deleteTeamRole,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['team', 'roles'] })
      setSelectedRowIds(new Set())
    },
  })

  const allVisibleSelected =
    filteredRoles.length > 0 &&
    filteredRoles.every((r) => selectedRowIds.has(r.id))
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        for (const r of filteredRoles) next.delete(r.id)
        return next
      })
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        for (const r of filteredRoles) next.add(r.id)
        return next
      })
    }
  }

  if (rolesQ.isLoading) {
    return (
      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        Loading roles…
      </p>
    )
  }
  if (rolesQ.isError) {
    return (
      <p className="mt-6 text-sm text-destructive" role="alert">
        Could not load roles. Please check your network or try again.
      </p>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Only administrators and managers can add or edit custom roles.
        </p>
      ) : null}

      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 sm:max-w-sm">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              className={cn(inputCls, 'h-9 w-full pl-9')}
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search roles…"
              aria-label="Search roles"
            />
          </div>
          <p className="shrink-0 text-sm text-muted-foreground">
            {filteredRoles.length} {filteredRoles.length === 1 ? 'role' : 'roles'}
          </p>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                className={cbCls}
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                aria-label="Select all visible roles"
              />
            </div>
            <span>Role</span>
            <span>People</span>
            <span className="text-right" />
          </div>
          {filteredRoles.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
              {listSearch.trim()
                ? 'No roles match that search.'
                : 'No custom roles yet. Add one to label people in your org.'}
            </p>
          ) : (
            <div>
              {filteredRoles.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.5rem_1fr_1fr_auto] items-center gap-2 border-b border-border/80 px-3 py-2.5 text-sm last:border-b-0 sm:px-4"
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className={cbCls}
                      checked={selectedRowIds.has(r.id)}
                      onChange={() => {
                        setSelectedRowIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                      aria-label={`Select ${r.name}`}
                    />
                  </div>
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {r.name}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    {r.members.slice(0, 8).map((m) => (
                      <div
                        key={m.memberId}
                        className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground"
                        title={`${m.firstName} ${m.lastName}`}
                      >
                        {initials(m.firstName, m.lastName)}
                      </div>
                    ))}
                    {r.members.length > 8 ? (
                      <span className="text-xs text-muted-foreground">
                        +{r.members.length - 8}
                      </span>
                    ) : null}
                    {r.members.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-1.5">
                    {canManage ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 border-border px-2 text-xs"
                          asChild
                        >
                          <Link to={`/team/roles/${r.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 border-border px-2 text-xs"
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete the role "${r.name}"? People will no longer be tagged with this label.`,
                              )
                            ) {
                              return
                            }
                            deleteMut.mutate(r.id)
                          }}
                        >
                          {deleteMut.isPending &&
                          deleteMut.variables === r.id
                            ? '…'
                            : 'Delete'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {deleteMut.isError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {deleteMut.error instanceof ApiError
              ? deleteMut.error.message
              : 'Could not delete role.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
