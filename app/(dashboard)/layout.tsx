/**
 * Dashboard 布局
 *
 * 职责：
 * 为所有 dashboard 子页面套上 AppShell 外壳。
 * 后续 Phase 1 将在此处接入认证重定向逻辑。
 */

import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
