import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { PageLoading } from '@/components/layout/page-loading'

export function AppShell() {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
          <p className="text-sm text-muted-foreground">
            React + Tailwind + shadcn/ui · 按领域拆分 features
          </p>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
