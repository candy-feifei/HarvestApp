import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api/http';
import { useAuth } from '@/lib/auth/auth-context';
import { registerRequest } from '@/features/auth/api';
import { Button } from '@/components/ui/button';

export function RegisterPage() {
  const { isAuthenticated, setSessionToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await registerRequest(
        email,
        password,
        name.trim() || undefined,
      );
      setSessionToken(res.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '注册失败，请稍后重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">注册</h1>
          <p className="text-sm text-muted-foreground">使用工作邮箱与密码创建账号</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reg-email">
              邮箱
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reg-name">
              姓名（选填）
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reg-password">
              密码（至少 8 位）
            </label>
            <input
              id="reg-password"
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
            {loading ? '提交中…' : '注册并登录'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          已有账号？{' '}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
