'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth/auth-store';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (json.success) {
        login(json.data.user);
        router.push('/');
      } else {
        setError(json.error || '登录失败，请检查用户名和密码');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ams-background">
      <div className="w-full max-w-md px-4">
        <div className="ams-card p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-ams bg-ams-primary text-white text-2xl font-bold">
              A
            </div>
            <h1 className="text-2xl font-bold text-ams-text-primary">
              运动员管理系统
            </h1>
            <p className="mt-2 text-sm text-ams-text-secondary">
              请登录以继续使用
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2.5 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2.5 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-ams-text-muted">
            <p>© {new Date().getFullYear()} 运动员管理系统</p>
          </div>
        </div>
      </div>
    </div>
  );
}