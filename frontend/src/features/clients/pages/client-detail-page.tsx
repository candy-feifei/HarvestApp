import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { fetchClient } from '@/features/clients/api'
import { Button } from '@/components/ui/button'

export function ClientDetailPage() {
  const { clientId = '' } = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: Boolean(clientId),
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (error) {
    const message =
      error instanceof ApiError && error.status === 404
        ? 'Client not found.'
        : 'Could not load client.'
    return <p className="text-sm text-destructive">{message}</p>
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" asChild className="mb-2 h-auto px-0 text-muted-foreground">
          <Link to="/clients">← Back to clients</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {data.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage this client’s projects, or{' '}
          <Link
            to={`/clients/${clientId}/contacts/new`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            add a contact
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
