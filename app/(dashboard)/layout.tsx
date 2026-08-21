/**
 * Dashboard 布局
 *
 * 职责：
 * 1. 服务端会话守卫：会话失效（未登录 / 账号已被删除或停用）时统一重定向到登录页，
 *    避免各页面静默显示空数据而让用户误以为数据丢失。
 * 2. 为所有 dashboard 子页面套上 AppShell 外壳。
 */

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/AuthMiddleware';
import { AppShell } from '@/components/layout/AppShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  return <AppShell>{children}</AppShell>;
}
