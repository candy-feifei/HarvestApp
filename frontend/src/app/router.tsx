import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/require-auth'
import { AppShell } from '@/components/layout/app-shell'
import { PageLoading } from '@/components/layout/page-loading'
import { appNavItems } from '@/lib/nav-config'
import { NotFoundPage } from '@/pages/not-found-page'

const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((m) => ({
    default: m.LoginPage,
  })),
)

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/dashboard-page').then((m) => ({
    default: m.DashboardPage,
  })),
)

const OrganizationPage = lazy(() =>
  import('@/features/organization/pages/organization-page').then((m) => ({
    default: m.OrganizationPage,
  })),
)

const ProjectsPage = lazy(() =>
  import('@/features/projects/pages/projects-page').then((m) => ({
    default: m.ProjectsPage,
  })),
)

const TasksPage = lazy(() =>
  import('@/features/tasks/pages/tasks-page').then((m) => ({
    default: m.TasksPage,
  })),
)

const TimePage = lazy(() =>
  import('@/features/time/pages/time-page').then((m) => ({
    default: m.TimePage,
  })),
)

const ReportsPage = lazy(() =>
  import('@/features/reports/pages/reports-page').then((m) => ({
    default: m.ReportsPage,
  })),
)

const ExpensesPage = lazy(() =>
  import('@/features/expenses/pages/expenses-page').then((m) => ({
    default: m.ExpensesPage,
  })),
)

const AccessPage = lazy(() =>
  import('@/features/access/pages/access-page').then((m) => ({
    default: m.AccessPage,
  })),
)

const SettingsPage = lazy(() =>
  import('@/features/settings/pages/settings-page').then((m) => ({
    default: m.SettingsPage,
  })),
)

const lazyModuleRoot = {
  organization: OrganizationPage,
  projects: ProjectsPage,
  tasks: TasksPage,
  time: TimePage,
  reports: ReportsPage,
  expenses: ExpensesPage,
  access: AccessPage,
  settings: SettingsPage,
} as const

function pathFromNavTo(to: string) {
  if (to === '/') return ''
  return to.replace(/^\//, '')
}

const moduleRoutes = appNavItems
  .filter((item) => item.id !== 'dashboard')
  .map((item) => {
    const Component = lazyModuleRoot[item.id as keyof typeof lazyModuleRoot]
    return {
      path: pathFromNavTo(item.to),
      element: <Component />,
    }
  })

export const appRouter = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoading />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      ...moduleRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
