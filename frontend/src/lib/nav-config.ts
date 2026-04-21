export type AppNavItem = {
  id: string
  title: string
  to: string
  description: string
}

/** 与 HarvestApp 核心模块对齐的导航占位，后续替换为真实页面与权限控制 */
export const appNavItems: AppNavItem[] = [
  {
    id: 'dashboard',
    title: '工作台',
    to: '/',
    description: '总览与快捷入口',
  },
  {
    id: 'organization',
    title: '用户与组织',
    to: '/organization',
    description: '成员、团队与组织架构',
  },
  {
    id: 'projects',
    title: '项目',
    to: '/projects',
    description: '项目列表与设置',
  },
  {
    id: 'tasks',
    title: '任务',
    to: '/tasks',
    description: '任务看板与分配',
  },
  {
    id: 'time',
    title: '时间记录',
    to: '/time',
    description: '工时填报与审批',
  },
  {
    id: 'reports',
    title: '报表',
    to: '/reports',
    description: '统计与导出',
  },
  {
    id: 'expenses',
    title: '发票 / 费用',
    to: '/expenses',
    description: '费用与开票相关',
  },
  {
    id: 'access',
    title: '权限与角色',
    to: '/access',
    description: 'RBAC 与数据范围',
  },
  {
    id: 'settings',
    title: '基础设置',
    to: '/settings',
    description: '系统与租户级配置',
  },
]

export function getAppNavItem(id: string): AppNavItem | undefined {
  return appNavItems.find((item) => item.id === id)
}
