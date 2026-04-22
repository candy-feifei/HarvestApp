import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { fetchClient } from '@/features/clients/api'
import { Button } from '@/components/ui/button'

export function ClientEditPage() {
  const { clientId = '' } = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: Boolean(clientId),
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (error) {
    const message =
      error instanceof ApiError && error.status === 404
        ? '未找到该客户。'
        : '无法加载客户信息。'
    return <p className="text-sm text-destructive">{message}</p>
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" asChild className="mb-2 h-auto px-0 text-muted-foreground">
          <Link to="/clients">← 返回客户列表</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">编辑客户</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.name} — 与「新建客户」共用的编辑表单可后续接到此页。
        </p>
      </div>
    </div>
  )
}
