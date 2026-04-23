import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { listClients, type ClientListItem } from '@/features/clients/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function contactSubline(title: string | null, email: string) {
  if (title?.trim()) {
    return `${title.trim()}, ${email}`
  }
  return email
}

type ClientBlockProps = {
  client: ClientListItem
}

function ClientBlock({ client }: ClientBlockProps) {
  const contacts = client.contacts ?? []

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-white shadow-sm',
        'hover:border-border',
      )}
    >
      <div
        className={cn(
          'flex min-h-[56px] items-center justify-between gap-3 px-3 py-2.5 sm:px-4',
          'hover:bg-muted/10',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 border-border px-2.5 text-[13px] font-normal text-foreground hover:bg-muted/60"
            asChild
          >
            <Link to={`/clients/${client.id}/edit`}>Edit</Link>
          </Button>
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground sm:text-base">
            {client.name}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 border-border px-2.5 text-[13px] font-normal text-foreground hover:bg-muted/60"
          asChild
        >
          <Link to={`/clients/${client.id}/contacts/new`}>
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
            Add contact
          </Link>
        </Button>
      </div>

      {contacts.length > 0 && (
        <div className="border-t border-border">
          {contacts.map((ct) => (
            <div
              key={ct.id}
              className="flex min-h-[48px] items-center gap-2 border-b border-border/60 bg-muted/[0.15] px-3 py-2.5 last:border-b-0 sm:gap-4 sm:px-4"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 self-start border-border px-2.5 text-[13px] font-normal text-foreground hover:bg-muted/60"
                asChild
              >
                <Link
                  to={`/clients/${client.id}/contacts/${ct.id}/edit`}
                >
                  Edit
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-foreground">
                  {ct.firstName} {ct.lastName}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {contactSubline(ct.title, ct.email)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ClientsPage() {
  const [filter, setFilter] = useState('')
  const q = useDeferredValue(filter)
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['clients', q],
    queryFn: () => listClients(q),
  })

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error
        ? '无法加载客户列表。'
        : null

  const items = data?.items ?? []
  const showEmpty = !isLoading && !errorMessage && items.length === 0
  const showList = !errorMessage && items.length > 0

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            客户
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理客户、账期与税率；创建后可添加项目与联系人。
          </p>
        </div>
        <Button asChild className="h-9 gap-2 self-start sm:self-auto">
          <Link to="/clients/new">
            <Plus className="size-4" aria-hidden />
            新建客户
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by client or contact"
          className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none"
          autoComplete="off"
          name="client-filter"
        />
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : null}

      {showList ? (
        <ul className="flex flex-col gap-2.5">
          {isFetching && !isLoading ? (
            <li className="text-xs text-muted-foreground">更新中…</li>
          ) : null}
          {items.map((c) => (
            <li key={c.id}>
              <ClientBlock client={c} />
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          还没有客户。点击「新建客户」开始，或调整筛选条件。
        </div>
      ) : null}
    </div>
  )
}
