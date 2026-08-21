'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  LogOut,
  Menu,
  User as UserIcon,
  ChevronDown,
  UserRound,
  KeyRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/auth-store';

const roleNames: Record<string, string> = {
  COACH: '教练员',
  MEDICAL: '医研人员',
  ADMIN: '管理员',
};

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /** 展示操作反馈提示（3 秒后自动消失） */
  const showFeedback = useCallback((type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => setFeedback(null), 3000);
  }, []);

  const closeAll = () => {
    setMenuOpen(false);
    setShowProfile(false);
    setShowPassword(false);
  };

  // Esc 关闭下拉菜单与弹窗
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    closeAll();
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-ams-border bg-ams-surface px-6">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            aria-label="打开导航菜单"
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
          <input
            type="text"
            placeholder="搜索运动员、训练记录..."
            className="w-full rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="通知">
          <Bell className="h-4 w-4" />
        </Button>
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="用户菜单"
              className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-ams-surface-hover"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ams-primary/20 text-ams-primary text-sm font-medium">
                {user.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-ams-text-primary">
                  {user.name}
                </div>
                <div className="text-xs text-ams-text-secondary">
                  {roleNames[user.role] || user.role}
                </div>
              </div>
              <ChevronDown className={`hidden h-4 w-4 text-ams-text-muted md:block transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <>
                {/* 点击遮罩关闭菜单 */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 ams-card p-1.5"
                >
                  <div className="px-3 py-2.5 mb-1 border-b border-ams-border">
                    <div className="text-sm font-semibold text-ams-text-primary">{user.name}</div>
                    <div className="text-xs text-ams-text-secondary">
                      @{user.username} · {roleNames[user.role] || user.role}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setShowProfile(true); }}
                    className="flex w-full items-center gap-2.5 rounded-ams px-3 py-2 text-sm text-ams-text-primary transition-colors hover:bg-ams-surface"
                  >
                    <UserRound className="h-4 w-4 text-ams-text-muted" />
                    个人信息
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setShowPassword(true); }}
                    className="flex w-full items-center gap-2.5 rounded-ams px-3 py-2 text-sm text-ams-text-primary transition-colors hover:bg-ams-surface"
                  >
                    <KeyRound className="h-4 w-4 text-ams-text-muted" />
                    修改密码
                  </button>
                  <div className="my-1 h-px bg-ams-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-ams px-3 py-2 text-sm text-ams-danger transition-colors hover:bg-ams-danger/10"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="icon" aria-label="用户菜单">
            <UserIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 操作反馈提示 */}
      {feedback && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-[70] -translate-x-1/2 flex items-center gap-2 rounded-ams border px-4 py-2.5 text-sm ${
            feedback.type === 'success'
              ? 'border-ams-success/40 bg-ams-success/10 text-ams-success'
              : 'border-ams-danger/40 bg-ams-danger/10 text-ams-danger'
          }`}
        >
          <span>{feedback.type === 'success' ? '✓' : '✕'} {feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="opacity-60 transition-opacity hover:opacity-100"
            aria-label="关闭提示"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 个人信息弹窗 */}
      {showProfile && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowProfile(false)}>
          <div className="w-full max-w-sm ams-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-ams-text-primary">个人信息</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowProfile(false)} aria-label="关闭">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ams-primary/20 text-ams-primary text-2xl font-semibold">
                {user.name.charAt(0)}
              </div>
              <div>
                <div className="text-base font-semibold text-ams-text-primary">{user.name}</div>
                <div className="text-sm text-ams-text-secondary">@{user.username}</div>
                <span className="mt-1 inline-block rounded-full bg-ams-primary/15 px-2 py-0.5 text-xs font-medium text-ams-primary">
                  {roleNames[user.role] || user.role}
                </span>
              </div>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ams-text-secondary">用户 ID</dt>
                <dd className="text-ams-text-primary">#{user.userId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ams-text-secondary">用户名</dt>
                <dd className="text-ams-text-primary">{user.username}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ams-text-secondary">姓名</dt>
                <dd className="text-ams-text-primary">{user.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ams-text-secondary">角色</dt>
                <dd className="text-ams-text-primary">{roleNames[user.role] || user.role}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ams-text-secondary">账户状态</dt>
                <dd className={user.isActive ? 'text-ams-success' : 'text-ams-danger'}>
                  {user.isActive ? '正常' : '已停用'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showPassword && (
        <PasswordModal
          onClose={() => setShowPassword(false)}
          onResult={showFeedback}
        />
      )}
    </header>
  );
}

// ============================================================
// 修改密码弹窗
// ============================================================

function PasswordModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (type: 'success' | 'error', text: string) => void;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) { setError('请输入原密码和新密码'); return; }
    if (newPassword.length < 6) { setError('新密码长度不能少于 6 位'); return; }
    if (newPassword !== confirmPassword) { setError('两次输入的新密码不一致'); return; }

    setIsSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      let json: { success?: boolean; error?: { message?: string } } | null = null;
      try { json = await res.json(); } catch { json = null; }
      if (json?.success) {
        onResult('success', '密码修改成功，下次登录请使用新密码');
        onClose();
      } else {
        setError(json?.error?.message || '密码修改失败，请重试');
      }
    } catch {
      setError('网络错误，密码修改失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm ams-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ams-text-primary">修改密码</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-2 text-sm text-ams-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ams-text-primary mb-1.5">原密码 *</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ams-text-primary mb-1.5">新密码 *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ams-text-primary mb-1.5">确认新密码 *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-ams-border">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '提交中...' : '确认修改'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
