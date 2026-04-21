import { Button } from '@/components/ui/button'

export function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          后续在此接入概览卡片、待办与快捷入口；当前用于验证主题与路由壳层。
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button>主操作</Button>
        <Button variant="secondary">次要</Button>
        <Button variant="outline">描边</Button>
        <Button variant="ghost">幽灵</Button>
      </div>
    </div>
  )
}
