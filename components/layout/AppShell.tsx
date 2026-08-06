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
 * 扩展点：
 * 未来可在顶栏增加面包屑、在侧边栏增加折叠功能。
 */

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-ams-background">
      {/* 侧边导航 */}
      <Sidebar />

      {/* 主区域：顶栏 + 内容 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="ams-scrollbar flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
