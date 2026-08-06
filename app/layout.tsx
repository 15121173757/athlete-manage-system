/**
 * 根布局 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 设置全局 HTML lang="zh-CN"
 * 2. 引入全局样式 globals.css
 * 3. 设置深色主题 class
 * 4. 渲染元数据（SEO）
 *
 * 非职责：
 * - 不在此处实现业务布局（由 dashboard/layout.tsx 负责）
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '运动员管理系统',
  description: '面向运动队内部的运动员训练管理系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
