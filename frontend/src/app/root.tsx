import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { appRouter } from '@/app/router'
import { AuthProvider } from '@/lib/auth/auth-context'

export function AppRoot() {
  return (
    <AppProviders>
      <AuthProvider>
        <RouterProvider router={appRouter} />
      </AuthProvider>
    </AppProviders>
  )
}
