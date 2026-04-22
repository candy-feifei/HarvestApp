import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { forgotPasswordRequest } from '@/features/auth/api'
import { Button } from '@/components/ui/button'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await forgotPasswordRequest(email)
      setDone(true)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '请求失败，请稍后重试'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">忘记密码</h1>
          <p className="text-sm text-muted-foreground">
            若该邮箱已注册，你将收到含重置链接的邮件（未配置 SMTP 时仅后端日志可见链接）
          </p>
        </div>
        {done ? (
          <p className="text-sm text-center text-muted-foreground">
            若该邮箱在系统中存在，我们已发送重置说明。请检查邮箱或开发环境服务器日志。
          </p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fp-email">
                邮箱
              </label>
              <input
                id="fp-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '提交中…' : '发送重置说明'}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            返回登录
          </Link>
        </p>
      </div>
    </div>
  )
}
