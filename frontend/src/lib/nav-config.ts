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
  Shield,
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
        title: '工时表',
        to: '/time',
        description: '日/周/月视图与填报',
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
        title: '团队',
        to: '/team',
        description: '成员、角色与分配',
        icon: Users,
      },
      {
        id: 'clients',
        title: '客户',
        to: '/clients',
        description: '客户与联系人',
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
        title: '发票',
        to: '/invoices',
        description: '开票与账期',
        icon: FileText,
      },
      {
        id: 'estimates',
        title: '预算报价',
        to: '/estimates',
        description: '估算与报价单',
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
        title: '报表',
        to: '/reports',
        description: '时间与盈利分析',
        icon: BarChart3,
      },
    ],
  },
]

/** 平铺的导航项（供路由等使用） */
export const appNavItemsFlat: AppNavItem[] = appNavSections.flatMap(
  (s) => s.items,
)

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
    title: '设置',
    to: '/settings',
    description: '系统与组织配置',
    icon: Settings2,
  },
  {
    id: 'access',
    title: '权限与角色',
    to: '/access',
    description: 'RBAC',
    icon: Shield,
  },
]
