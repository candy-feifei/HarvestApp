import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ListChecks,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react'

export type AppNavItem = {
  id: string
  title: string
  to: string
  description: string
  icon: LucideIcon
  /** 右侧徽标（如待审批条数，占位） */
  pendingCount?: number
}

export type AppNavSection = {
  id: 'track' | 'organize' | 'bill' | 'review'
  /** 侧栏分组标题（与参考 UI 一致） */
  label: string
  items: AppNavItem[]
}

/** 与产品 PRD 分区一致；分组标题与参考线框图一致 */
export const appNavSections: AppNavSection[] = [
  {
    id: 'track',
    label: 'Track',
    items: [
      {
        id: 'time',
        title: 'Timesheet',
        to: '/time',
        description: 'Day, week, and month views',
        icon: Clock,
      },
      {
        id: 'expenses',
        title: 'Expenses',
        to: '/expenses',
        description: 'Expenses & reimbursement',
        icon: Wallet,
      },
    ],
  },
  {
    id: 'organize',
    label: 'Organize',
    items: [
      {
        id: 'team',
        title: 'Team',
        to: '/team',
        description: 'Members, roles, and assignments',
        icon: Users,
      },
      {
        id: 'clients',
        title: 'Clients',
        to: '/clients',
        description: 'Clients and contacts',
        icon: Building2,
      },
      {
        id: 'projects',
        title: 'Projects',
        to: '/projects',
        description: 'Projects',
        icon: FolderOpen,
      },
      {
        id: 'tasks',
        title: 'Tasks',
        to: '/tasks',
        description: 'Organization task list and project tasks',
        icon: ListChecks,
      },
    ],
  },
  {
    id: 'bill',
    label: 'Bill',
    items: [
      {
        id: 'invoices',
        title: 'Invoices',
        to: '/invoices',
        description: 'Invoicing and payment terms',
        icon: FileText,
      },
      {
        id: 'estimates',
        title: 'Estimates',
        to: '/estimates',
        description: 'Quotes and estimates',
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    id: 'review',
    label: 'Review',
    items: [
      {
        id: 'approvals',
        title: 'Approvals',
        to: '/approvals',
        description: 'Work hour approval and expense approval',
        icon: CheckCircle2,
        pendingCount: 1,
      },
      {
        id: 'reports',
        title: 'Reports',
        to: '/reports',
        description: 'Time and Profitability',
        icon: BarChart3,
      },
    ],
  },
]

/** 平铺的导航项（供路由等使用） */
export const appNavItemsFlat: AppNavItem[] = appNavSections.flatMap(
  (s) => s.items,
)

/** 登录后与访问 `/` 时进入的首个业务模块（与侧栏顺序一致） */
export const defaultAppLandingPath = appNavItemsFlat[0]!.to

export function getAppNavItem(id: string): AppNavItem | undefined {
  return (
    appNavItemsFlat.find((item) => item.id === id) ??
    appFooterNavItems.find((item) => item.id === id)
  )
}

/** 底栏：系统与权限（不在主图侧栏中，仍保留入口） */
export const appFooterNavItems: AppNavItem[] = [
  {
    id: 'settings',
    title: 'Settings',
    to: '/settings',
    description: 'System and organization',
    icon: Settings2,
  },
]
