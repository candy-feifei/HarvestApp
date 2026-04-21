import { getAppNavItem } from '@/lib/nav-config'

type FeatureModuleStubProps = {
  navId: string
}

/** 各业务模块落地前的统一占位，避免路由与侧栏已就绪但页面分散 */
export function FeatureModuleStub({ navId }: FeatureModuleStubProps) {
  const meta = getAppNavItem(navId)
  if (!meta) return null

  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
      <p className="text-sm text-muted-foreground">{meta.description}</p>
      <p className="text-sm text-muted-foreground">
        建议在{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          src/features/{navId}/
        </code>{' '}
        下扩展 <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pages</code>、
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">components</code> 与{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">api.ts</code>
        ；请求统一使用{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">apiRequest</code>（
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          src/lib/api/http.ts
        </code>
        ），列表类数据优先使用 TanStack Query。
      </p>
    </div>
  )
}
