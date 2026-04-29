import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import { loginRequest } from '@/features/auth/api'
import { Button } from '@/components/ui/button'
import { defaultAppLandingPath } from '@/lib/nav-config'

export function LoginPage() {
  const { isAuthenticated, setSessionToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string } | null
  const from =
    typeof state?.from === 'string' && state.from !== '/login'
      ? state.from
      : defaultAppLandingPath

  const [email, setEmail] = useState('demo@harvest.app')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const termsUrl =
    (import.meta.env.VITE_LEGAL_TERMS_URL as string | undefined) ||
    'https://www.example.com/terms'
  const privacyUrl =
    (import.meta.env.VITE_LEGAL_PRIVACY_URL as string | undefined) ||
    'https://www.example.com/privacy'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await loginRequest(email, password)
      setSessionToken(res.access_token)
      navigate(from, { replace: true })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Sign in failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <img
            src="/chrona_header.png"
            alt="Chrona"
            className="mx-auto h-18 w-auto select-none"
            draggable={false}
          />
          <h1 className="text-xl font-semibold tracking-tight">Sign in to Chrona</h1>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
            <p className="text-right text-xs">
              <Link
                to="/forgot-password"
                className="text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our{' '}
          <a
            href={termsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href={privacyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
