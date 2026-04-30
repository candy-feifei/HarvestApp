import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/auth-context'

type RequireAuthProps = {
  children: ReactNode
}

/**
 * Redirects to login when there is no access_token. On 401, `apiRequest` clears the token and
 * dispatches an event; AuthProvider clears state and this wrapper sends the user to sign in.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  }

  return <>{children}</>
}
