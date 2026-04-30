import { useState } from 'react'
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import { resetPasswordRequest } from '@/features/auth/api'
import { Button } from '@/components/ui/button'
import { defaultAppLandingPath } from '@/lib/nav-config'

export function ResetPasswordPage() {
  const { isAuthenticated, setSessionToken } = useAuth()
  const [search] = useSearchParams()
  const token = search.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={defaultAppLandingPath} replace />
  }

  if (!token) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
        <p className="text-sm text-muted-foreground">
          Missing or invalid reset link. Open this page from the email we sent you.
        </p>
        <Link to="/forgot-password" className="mt-4 text-sm text-primary underline-offset-4 hover:underline">
          Request a new reset link
        </Link>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await resetPasswordRequest(token, password)
      setSessionToken(res.access_token)
      navigate(defaultAppLandingPath, { replace: true })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Reset failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="rp-pw">
              New password
            </label>
            <input
              id="rp-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
              minLength={8}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
