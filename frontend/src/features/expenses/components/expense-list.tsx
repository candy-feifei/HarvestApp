import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExpenseListItem } from '@/features/expenses/api'
import {
  groupExpensesByWeek,
  statusLabel,
  weekHeaderStatus,
} from '@/features/expenses/lib/group-expenses-by-week'

type ExpenseListProps = {
  items: ExpenseListItem[]
  currency: string
  isLoading: boolean
  /** When true, show submitter on each row (org-wide view) */
  showSubmitter?: boolean
  /** Only allow deleting own unlocked expenses; matches API */
  currentUserId?: string
  onDelete?: (id: string) => void
}

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.length === 3 ? currency : 'USD',
  }).format(n)
}

function lineDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function ExpenseList({
  items,
  currency,
  isLoading,
  showSubmitter,
  currentUserId,
  onDelete,
}: ExpenseListProps) {
  const groups = useMemo(() => groupExpensesByWeek(items), [items])

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading expenses…</p>
    )
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No expenses yet. Click &quot;Track expense&quot; to add one.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const head = weekHeaderStatus(g.items)
        return (
          <section key={g.key} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {g.label}
                </h3>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    head.className,
                  )}
                >
                  {head.label}
                </span>
              </div>
            </div>
            <ul className="space-y-0">
              {g.items.map((e) => {
                const st = statusLabel(e.status)
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-start gap-3 border-b border-border/60 py-2.5 last:border-b-0"
                  >
                    <div className="w-24 shrink-0 text-xs text-muted-foreground sm:text-sm">
                      {lineDate(e.spentDate)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {e.project.name}
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          ({e.project.client.name})
                        </span>
                      </p>
                      {showSubmitter ? (
                        <p className="text-xs text-muted-foreground">
                          {e.user.firstName} {e.user.lastName}
                        </p>
                      ) : null}
                      <p className="text-sm text-foreground">
                        {e.category.name}
                        {e.isBillable ? (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Billable
                          </span>
                        ) : null}
                        {e.isReimbursable ? (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Reimbursable
                          </span>
                        ) : null}
                        <span className={cn('ml-2 text-xs', st.className)}>
                          {st.label}
                        </span>
                      </p>
                      {e.receiptUrl ? (
                        <p className="mt-0.5 text-xs">
                          <a
                            href={e.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Receipt
                          </a>
                        </p>
                      ) : null}
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      {e.isLocked ? (
                        <Lock
                          className="size-3.5 text-muted-foreground"
                          aria-label="Locked"
                        />
                      ) : null}
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(Number(e.amount), currency)}
                      </span>
                    </div>
                    {!e.isLocked &&
                    onDelete &&
                    (!currentUserId || e.user.id === currentUserId) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(e.id)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <div className="flex justify-end border-t border-border/80 pt-2 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="ml-3 font-semibold tabular-nums">
                {formatMoney(g.total, currency)}
              </span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
