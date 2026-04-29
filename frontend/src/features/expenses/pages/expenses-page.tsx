import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useDeferredValue, useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { parseJwtPayloadJson } from '@/lib/auth/jwt-payload'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  deleteExpense,
  fetchExpenseFormOptions,
  listExpenses,
  submitExpenseWeek,
} from '@/features/expenses/api'
import { startOfIsoWeekYmd } from '@/features/time/time-range'
import { todayUtcYmd } from '@/features/time/time-format'
import { listTeamMembers } from '@/features/team/api'
import { CategoryManager } from '@/features/expenses/components/category-manager'
import { ExpenseList } from '@/features/expenses/components/expense-list'
import { ExpenseTrackForm } from '@/features/expenses/components/expense-track-form'

type Tab = 'all' | 'categories'

export function ExpensesPage() {
  const { accessToken } = useAuth()
  const selfId = parseJwtPayloadJson(accessToken)?.sub ?? ''
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [categoryCreating, setCategoryCreating] = useState(false)
  const [teammateOpen, setTeammateOpen] = useState(false)
  const [teammateQuery, setTeammateQuery] = useState('')
  const dq = useDeferredValue(teammateQuery)

  /** All org / self / selected member */
  const [scope, setScope] = useState<'all' | 'self' | 'member'>('self')
  const [memberUserId, setMemberUserId] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== 'categories') {
      setCategoryCreating(false)
    }
  }, [tab])

  const { data: team } = useQuery({
    queryKey: ['team-members'],
    queryFn: listTeamMembers,
  })
  const { data: formOptions } = useQuery({
    queryKey: ['expense-form-options'],
    queryFn: fetchExpenseFormOptions,
  })

  const listParams = useMemo(() => {
    if (scope === 'all') {
      return { includeAllMembers: true as const }
    }
    if (scope === 'self' && selfId) {
      return { userId: selfId }
    }
    if (scope === 'member' && memberUserId) {
      return { userId: memberUserId }
    }
    return selfId ? { userId: selfId } : {}
  }, [scope, selfId, memberUserId])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['expenses', listParams],
    queryFn: () => listExpenses(listParams),
    enabled: tab === 'all',
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })

  const submitWeekMut = useMutation({
    mutationFn: () => submitExpenseWeek(startOfIsoWeekYmd(todayUtcYmd())),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not load expenses.'
        : null

  const members = team?.items ?? []
  const filteredMembers = useMemo(() => {
    if (!dq.trim()) return members
    const t = dq.trim().toLowerCase()
    return members.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(t) ||
        m.email.toLowerCase().includes(t),
    )
  }, [members, dq])

  const teammateLabel = useMemo(() => {
    if (scope === 'all') return 'Everyone'
    if (scope === 'self') return 'Me'
    if (memberUserId) {
      const m = members.find((u) => u.userId === memberUserId)
      if (m) return `${m.firstName} ${m.lastName}`.trim() || m.email
    }
    return 'Teammate'
  }, [scope, memberUserId, members])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Expenses
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'all' ? (
            <>
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTeammateOpen((o) => !o)}
                >
                  Teammate: {teammateLabel}
                  <ChevronDown className="size-3.5" />
                </Button>
                {teammateOpen ? (
                  <div
                    className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-white p-2 shadow-md"
                    role="menu"
                  >
                    <input
                      className="mb-2 w-full rounded border border-border px-2 py-1.5 text-sm"
                      placeholder="Search…"
                      value={teammateQuery}
                      onChange={(e) => setTeammateQuery(e.target.value)}
                    />
                    <ul className="max-h-56 overflow-y-auto text-sm">
                      <li>
                        <button
                          type="button"
                          className={cn(
                            'w-full rounded px-2 py-1.5 text-left hover:bg-muted',
                            scope === 'all' && 'bg-muted',
                          )}
                          onClick={() => {
                            setScope('all')
                            setMemberUserId(null)
                            setTeammateOpen(false)
                          }}
                        >
                          Everyone
                        </button>
                      </li>
                      {selfId ? (
                        <li>
                          <button
                            type="button"
                            className={cn(
                              'w-full rounded px-2 py-1.5 text-left hover:bg-muted',
                              scope === 'self' && 'bg-muted',
                            )}
                            onClick={() => {
                              setScope('self')
                              setMemberUserId(null)
                              setTeammateOpen(false)
                            }}
                          >
                            Me
                          </button>
                        </li>
                      ) : null}
                      {filteredMembers.map((m) => (
                        <li key={m.userId}>
                          <button
                            type="button"
                            className={cn(
                              'w-full rounded px-2 py-1.5 text-left hover:bg-muted',
                              scope === 'member' && memberUserId === m.userId
                                ? 'bg-muted'
                                : '',
                            )}
                            onClick={() => {
                              setScope('member')
                              setMemberUserId(m.userId)
                              setTeammateOpen(false)
                            }}
                          >
                            {m.firstName} {m.lastName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="size-4" />
                Track expense
              </Button>
              {scope === 'self' || scope === 'all' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 border-border"
                  disabled={submitWeekMut.isPending}
                  onClick={() => submitWeekMut.mutate()}
                >
                  {submitWeekMut.isPending
                    ? 'Submitting…'
                    : 'Submit week for approval'}
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              type="button"
              className="gap-1.5"
              variant={categoryCreating ? 'secondary' : 'default'}
              onClick={() => setCategoryCreating((o) => !o)}
            >
              <Plus className="size-4" />
              {categoryCreating ? 'Close' : 'New category'}
            </Button>
          )}
        </div>
      </div>

      <div className="inline-flex gap-0 rounded-lg border border-border p-0.5">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            tab === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          All expenses
        </button>
        <button
          type="button"
          onClick={() => setTab('categories')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            tab === 'categories'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Categories
        </button>
      </div>

      {tab === 'all' ? (
        <>
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Refreshing…</p>
          ) : null}
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
          <ExpenseList
            items={data?.items ?? []}
            currency={formOptions?.defaultCurrency ?? 'USD'}
            isLoading={isLoading}
            showSubmitter={scope === 'all' || scope === 'member'}
            currentUserId={selfId}
            onDelete={(id) => {
              if (window.confirm('Delete this expense?')) {
                void delMut.mutate(id)
              }
            }}
          />
        </>
      ) : (
        <CategoryManager
          creating={categoryCreating}
          onCreatingChange={setCategoryCreating}
        />
      )}

      <ExpenseTrackForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
