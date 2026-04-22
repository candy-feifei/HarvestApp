import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import { loginRequest } from '@/features/auth/api'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const { isAuthenticated, setSessionToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string } | null
  const from =
    typeof state?.from === 'string' && state.from !== '/login'
      ? state.from
      : '/'

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await loginRequest(email, password)
      setSessionToken(res.access_token)
      navigate(from, { replace: true })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '登录失败，请稍后重试'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">登录 HarvestApp</h1>
          <p className="text-sm text-muted-foreground">
            使用工作邮箱与密码。可先执行{' '}
            <code className="rounded bg-muted px-1 text-xs">npx prisma db seed</code>{' '}
            创建 demo@harvest.app / demo123
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              邮箱
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
              密码
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
                忘记密码？
              </Link>
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          登录即表示同意{' '}
          <a
            href={termsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            服务条款
          </a>{' '}
          与{' '}
          <a
            href={privacyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            隐私政策
          </a>
          。令牌存于 sessionStorage（关标签页即失效）
        </p>
        <p className="text-center text-sm text-muted-foreground">
          没有账号？{' '}
          <Link
            to="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            注册
          </Link>
        </p>
        <p className="text-center text-sm">
          <Button variant="link" asChild className="h-auto p-0">
            <Link to="/">返回首页（未登录会再次跳转登录）</Link>
          </Button>
        </p>
      </div>
    </div>
  )
}
