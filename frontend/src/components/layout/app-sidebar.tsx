import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Timer } from 'lucide-react'
import { appNavItems } from '@/lib/nav-config'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppSidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Timer className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">HarvestApp</p>
          <p className="truncate text-xs text-muted-foreground">复刻骨架</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {appNavItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive &&
                  'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
              )
            }
          >
            {item.title}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground"
          onClick={handleLogout}
        >
          <LogOut className="size-4" aria-hidden />
          退出登录
        </Button>
      </div>
    </aside>
  )
}
