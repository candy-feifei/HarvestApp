import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import {
  appFooterNavItems,
  appNavSections,
} from '@/lib/nav-config'
import { useAuth } from '@/lib/auth/auth-context'
import {
  emailToInitials,
  parseJwtPayloadJson,
} from '@/lib/auth/jwt-payload'
import { fetchOrganizationContext } from '@/features/clients/api'
import { fetchApprovalsView } from '@/features/approvals/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const brand = {
  /** 参考线稿主色 */
  primary: '#0061FF',
}

function nameInitials(first: string, last: string) {
  const a = (first.trim()[0] ?? '').toUpperCase()
  const b = (last.trim()[0] ?? '').toUpperCase()
  return `${a}${b}` || '?'
}

function isSidebarItemActive(pathname: string, to: string) {
  if (to === '/') {
    return pathname === '/'
  }
  if (to === '/clients') {
    return pathname === '/clients' || pathname.startsWith('/clients/')
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppSidebar() {
  const { accessToken, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: org } = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })
  const payload = parseJwtPayloadJson(accessToken)
  const emailFallback = payload?.email ?? ''
  const firstName = org?.firstName?.trim() || ''
  const lastName = org?.lastName?.trim() || ''
  const workEmail = org?.email || emailFallback
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ').trim() || workEmail
  const initials =
    firstName || lastName
      ? nameInitials(firstName || ' ', lastName || ' ')
      : emailFallback
        ? emailToInitials(emailFallback)
        : 'U'
  const isApprover =
    org &&
    (org.systemRole === 'ADMINISTRATOR' || org.systemRole === 'MANAGER')
  const to = new Date()
  const from = new Date(to)
  from.setUTCFullYear(from.getUTCFullYear() - 1)
  to.setUTCFullYear(to.getUTCFullYear() + 1)
  const { data: approvalPending = 0 } = useQuery({
    queryKey: [
      'approvals',
      'nav-pending',
      org?.organizationId,
      from.toISOString().slice(0, 10),
    ],
    queryFn: () =>
      fetchApprovalsView(
        {
          from: from.toISOString(),
          to: to.toISOString(),
          groupBy: 'PERSON',
          entryStatus: 'SUBMITTED',
        },
        org!.organizationId,
      ),
    enabled: Boolean(isApprover && org),
    select: (v) => v.rows.filter((r) => r.hasApprovableSubmitted).length,
  })

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex w-[256px] shrink-0 flex-col border-r border-border bg-white">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex h-[56px] cursor-pointer items-center gap-3 border-b border-border px-4 text-left transition-opacity hover:opacity-90"
      >
        <div className="flex size-12 items-center justify-center rounded-lg">
          <img
            src="/chrona_logo.png"
            alt="Chrona"
            className="size-12 select-none object-contain"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
            Chrona
          </p>
          <p className="truncate text-xs text-muted-foreground">Time & projects</p>
        </div>
      </button>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
        {appNavSections.map((section) => (
          <div key={section.id}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = isSidebarItemActive(pathname, item.to)
                const badge =
                  item.id === 'approvals' && isApprover && approvalPending > 0
                    ? approvalPending
                    : undefined
                return (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      className={cn(
                        'group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                        !isActive && [
                          'text-muted-foreground',
                          'hover:bg-muted/80 hover:text-foreground',
                        ],
                        isActive && [
                          'bg-[#0061FF] font-semibold text-white shadow-sm',
                        ],
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-[18px] shrink-0',
                          isActive
                            ? 'text-white'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">{item.title}</span>
                      {item.id === 'approvals' && badge != null && badge > 0 && (
                        <span
                          className={cn(
                            'flex min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[#0061FF] text-white',
                          )}
                          title="Pending"
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0 border-t border-border px-2 py-2">
        {appFooterNavItems.map((item) => {
          const Icon = item.icon
          const active = isSidebarItemActive(pathname, item.to)
          return (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                active
                  ? 'font-medium text-[#0061FF]'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <Icon
                className="size-4 shrink-0 opacity-90"
                strokeWidth={1.75}
                aria-hidden
              />
              {item.title}
            </Link>
          )
        })}

        <div className="mt-2 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2.5">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: brand.primary }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {workEmail || 'Signed in'}
              </p>
            </div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground opacity-60"
              aria-hidden
            />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-9 w-full cursor-pointer justify-start gap-2 rounded-lg px-2 text-[13px] font-normal text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
          Log out
        </Button>
      </div>
    </aside>
  )
}
