import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { listTeamMembers, type TeamMemberRow } from '@/features/team/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UserPlus } from 'lucide-react'

const tabBase =
  'inline-flex h-9 min-w-0 items-center border-b-2 px-1 pb-0.5 text-sm font-medium transition-colors'

type TabId = 'members' | 'roles'

function typeLabel(t: TeamMemberRow['employmentType']) {
  return t === 'CONTRACTOR' ? 'Contractor' : 'Employee'
}

function MembersPanel({
  members,
  loading,
  isError,
}: {
  members: TeamMemberRow[] | undefined
  loading: boolean
  isError: boolean
}) {
  if (loading) {
    return (
      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        正在加载成员…
      </p>
    )
  }
  if (isError) {
    return (
      <p className="mt-6 text-sm text-destructive" role="alert">
        无法加载成员列表，请检查网络或重新登录后重试。
      </p>
    )
  }
  const rows = members ?? []
  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          共 {rows.length} 位成员
        </p>
        <Button
          type="button"
          asChild
          className="h-9 w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Link to="/team/invite">
            <UserPlus className="size-4" strokeWidth={2.25} aria-hidden />
            Invite person
          </Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_1.2fr_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
          <span>姓名</span>
          <span>工作邮箱</span>
          <span className="text-right">Type</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
            还没有成员。点击「Invite person」发送邀请邮件。
          </p>
        ) : (
          rows.map((m) => (
            <div
              key={m.memberId}
              className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-2 border-b border-border/80 px-3 py-2.5 text-sm last:border-b-0 sm:px-4"
            >
              <span className="min-w-0 font-medium text-foreground">
                {m.firstName} {m.lastName}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {m.email}
              </span>
              <span className="text-right text-xs text-muted-foreground sm:text-sm">
                {typeLabel(m.employmentType)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

type TeamLocationState = {
  invited?: boolean
  setPasswordUrl?: string
} | null

export function TeamPage() {
  const [tab, setTab] = useState<TabId>('members')
  const location = useLocation()
  const inviteState = (location.state as TeamLocationState) ?? null
  const q = useQuery({
    queryKey: ['team', 'members'],
    queryFn: listTeamMembers,
  })

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
      {inviteState?.invited ? (
        <div className="mb-4 space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
          <p>邀请已处理。若已配置发信，对方会收到邮件。</p>
          {import.meta.env.DEV && inviteState.setPasswordUrl ? (
            <p className="text-xs break-all text-muted-foreground">
              开发用：新成员设置密码链接 {inviteState.setPasswordUrl}
            </p>
          ) : null}
        </div>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Team
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">管理组织成员与角色。</p>

      <div className="mt-6 border-b border-border">
        <nav
          className="flex flex-wrap gap-6"
          role="tablist"
          aria-label="Team sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'members'}
            onClick={() => setTab('members')}
            className={cn(
              tabBase,
              tab === 'members'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Members
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'roles'}
            onClick={() => setTab('roles')}
            className={cn(
              tabBase,
              tab === 'roles'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Roles
          </button>
        </nav>
      </div>

      {tab === 'members' ? (
        <MembersPanel
          members={q.data?.items}
          loading={q.isLoading}
          isError={q.isError}
        />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          角色与权限说明将随后续版本在此配置。当前可前往 Members 邀请同事。
        </p>
      )}
    </div>
  )
}
