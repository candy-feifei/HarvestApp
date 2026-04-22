import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { PageLoading } from '@/components/layout/page-loading'

export function AppShell() {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-white px-6">
          <p className="text-sm text-muted-foreground">工作台与业务模块</p>
        </header>
        <main className="flex-1 overflow-auto p-5 md:p-6">
          <div className="min-h-full rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
