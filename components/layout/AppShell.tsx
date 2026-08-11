'use client';

/**
 * 应用外壳（AppShell） —— 运动员管理系统（AMS）
 *
 * 职责：
 * 组合侧边栏 + 顶栏 + 主内容区，构成 dashboard 的整体布局骨架。
 *
 * 设计说明：
 * 这是一个纯布局组件，不包含业务逻辑。
 * 子页面通过 children 注入主内容区。
 *
 * 响应式说明：
 * 桌面端（md 及以上）固定显示侧边栏；
 * 移动端通过顶栏汉堡菜单打开抽屉式导航，避免固定侧边栏挤压内容区。
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-ams-background">
      {/* 侧边导航（桌面端固定显示） */}
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>

      {/* 主区域：顶栏 + 内容 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="ams-scrollbar flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* 移动端导航抽屉 */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="关闭导航菜单"
              className="m-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ams-surface text-ams-text-secondary transition-colors hover:text-ams-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
