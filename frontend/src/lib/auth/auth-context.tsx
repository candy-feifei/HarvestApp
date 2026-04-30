import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AUTH_EXPIRED_EVENT,
  clearAccessToken,
  getAccessToken,
  setAccessToken as persistAccessToken,
} from '@/lib/auth/access-token'

type AuthContextValue = {
  accessToken: string | null
  /** Persist token in sessionStorage and refresh consumers. */
  setSessionToken: (token: string) => void
  /** Clear token and sign out locally. */
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(() =>
    getAccessToken(),
  )

  const setSessionToken = useCallback((token: string) => {
    persistAccessToken(token)
    setAccessTokenState(token)
  }, [])

  const logout = useCallback(() => {
    clearAccessToken()
    setAccessTokenState(null)
  }, [])

  useEffect(() => {
    const onExpired = () => {
      clearAccessToken()
      setAccessTokenState(null)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      setSessionToken,
      logout,
      isAuthenticated: Boolean(accessToken),
    }),
    [accessToken, setSessionToken, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
