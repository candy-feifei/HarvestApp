import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/auth-context'

type RequireAuthProps = {
  children: ReactNode
}

/**
 * 无 access_token 时跳转登录；401 时由 `apiRequest` 清 token 并派发事件，AuthProvider 清空状态后本组件重定向。
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
