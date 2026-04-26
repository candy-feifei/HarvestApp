import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/require-auth'
import { AppShell } from '@/components/layout/app-shell'
import { PageLoading } from '@/components/layout/page-loading'
import { appFooterNavItems, appNavItemsFlat } from '@/lib/nav-config'
import { NotFoundPage } from '@/pages/not-found-page'

const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((m) => ({
    default: m.LoginPage,
  })),
)

const RegisterPage = lazy(() =>
  import('@/features/auth/pages/register-page').then((m) => ({
    default: m.RegisterPage,
  })),
)

const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/pages/forgot-password-page').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
)

const ResetPasswordPage = lazy(() =>
  import('@/features/auth/pages/reset-password-page').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/dashboard-page').then((m) => ({
    default: m.DashboardPage,
  })),
)

const TeamPage = lazy(() =>
  import('@/features/team/pages/team-page').then((m) => ({ default: m.TeamPage })),
)

const TeamInvitePage = lazy(() =>
  import('@/features/team/pages/team-invite-page').then((m) => ({
    default: m.TeamInvitePage,
  })),
)

const TeamMemberEditPage = lazy(() =>
  import('@/features/team/pages/team-member-edit-page').then((m) => ({
    default: m.TeamMemberEditPage,
  })),
)

const ClientsPage = lazy(() =>
  import('@/features/clients/pages/clients-page').then((m) => ({
    default: m.ClientsPage,
  })),
)

const NewClientPage = lazy(() =>
  import('@/features/clients/pages/new-client-page').then((m) => ({
    default: m.NewClientPage,
  })),
)

const ClientEditPage = lazy(() =>
  import('@/features/clients/pages/client-edit-page').then((m) => ({
    default: m.ClientEditPage,
  })),
)

const ClientDetailPage = lazy(() =>
  import('@/features/clients/pages/client-detail-page').then((m) => ({
    default: m.ClientDetailPage,
  })),
)

const NewClientContactPage = lazy(() =>
  import('@/features/clients/pages/new-client-contact-page').then((m) => ({
    default: m.NewClientContactPage,
  })),
)

const ClientContactEditPage = lazy(() =>
  import('@/features/clients/pages/client-contact-edit-page').then((m) => ({
    default: m.ClientContactEditPage,
  })),
)

const ProjectsPage = lazy(() =>
  import('@/features/projects/pages/projects-page').then((m) => ({
    default: m.ProjectsPage,
  })),
)

const ProjectFormPage = lazy(() =>
  import('@/features/projects/pages/project-form-page').then((m) => ({
    default: m.ProjectFormPage,
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

const InvoicesPage = lazy(() =>
  import('@/features/invoicing/pages/invoices-page').then((m) => ({
    default: m.InvoicesPage,
  })),
)

const EstimatesPage = lazy(() =>
  import('@/features/invoicing/pages/estimates-page').then((m) => ({
    default: m.EstimatesPage,
  })),
)

const ApprovalsPage = lazy(() =>
  import('@/features/approvals/pages/approvals-page').then((m) => ({
    default: m.ApprovalsPage,
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
  time: TimePage,
  expenses: ExpensesPage,
  team: TeamPage,
  clients: ClientsPage,
  projects: ProjectsPage,
  tasks: TasksPage,
  invoices: InvoicesPage,
  estimates: EstimatesPage,
  approvals: ApprovalsPage,
  reports: ReportsPage,
  access: AccessPage,
  settings: SettingsPage,
} as const

function pathFromNavTo(to: string) {
  if (to === '/') return ''
  return to.replace(/^\//, '')
}

const allModuleItems = [...appNavItemsFlat, ...appFooterNavItems]

const moduleRoutes = allModuleItems
  .filter((item) => item.id !== 'projects')
  .map((item) => {
    const Component = lazyModuleRoot[item.id as keyof typeof lazyModuleRoot]
    if (!Component) {
      throw new Error(`No lazy page for nav id: ${item.id}`)
    }
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
    path: '/register',
    element: (
      <Suspense fallback={<PageLoading />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <Suspense fallback={<PageLoading />}>
        <ForgotPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <Suspense fallback={<PageLoading />}>
        <ResetPasswordPage />
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
      { path: 'clients/new', element: <NewClientPage /> },
      {
        path: 'clients/:clientId/edit',
        element: (
          <Suspense fallback={<PageLoading />}>
            <ClientEditPage />
          </Suspense>
        ),
      },
      {
        path: 'clients/:clientId/contacts/new',
        element: (
          <Suspense fallback={<PageLoading />}>
            <NewClientContactPage />
          </Suspense>
        ),
      },
      {
        path: 'clients/:clientId/contacts/:contactId/edit',
        element: (
          <Suspense fallback={<PageLoading />}>
            <ClientContactEditPage />
          </Suspense>
        ),
      },
      {
        path: 'clients/:clientId',
        element: (
          <Suspense fallback={<PageLoading />}>
            <ClientDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'team/invite',
        element: (
          <Suspense fallback={<PageLoading />}>
            <TeamInvitePage />
          </Suspense>
        ),
      },
      {
        path: 'team/members/:memberId/edit',
        element: (
          <Suspense fallback={<PageLoading />}>
            <TeamMemberEditPage />
          </Suspense>
        ),
      },
      {
        path: 'projects/new',
        element: (
          <Suspense fallback={<PageLoading />}>
            <ProjectFormPage />
          </Suspense>
        ),
      },
      {
        path: 'projects/:projectId/edit',
        element: (
          <Suspense fallback={<PageLoading />}>
            <ProjectFormPage />
          </Suspense>
        ),
      },
      {
        path: 'projects',
        element: (
          <Suspense fallback={<PageLoading />}>
            <ProjectsPage />
          </Suspense>
        ),
      },
      ...moduleRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
