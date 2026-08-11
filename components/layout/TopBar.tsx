'use client';

import { useRouter } from 'next/navigation';
import { Search, Bell, LogOut, Menu, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/auth-store';

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
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
        <h1 className="text-lg font-semibold text-ams-text-primary">
          数据看板
        </h1>
      </div>

      <div className="flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
          <input
            type="text"
            placeholder="搜索运动员、训练记录或输入自然语言查询..."
            className="w-full rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="通知">
          <Bell className="h-4 w-4" />
        </Button>
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ams-primary/20 text-ams-primary text-sm font-medium">
                {user.name.charAt(0)}
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-ams-text-primary">
                  {user.name}
                </div>
                <div className="text-xs text-ams-text-secondary">
                  {user.role === 'COACH' ? '教练员' : user.role === 'MEDICAL' ? '医研人员' : '管理员'}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="退出登录">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" aria-label="用户菜单">
            <UserIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}