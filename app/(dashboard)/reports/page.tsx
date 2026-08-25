'use client';

import { Suspense } from 'react';
import ReportCenter from './components/ReportCenter';

/**
 * 报告中心页面 —— /reports
 * 训练报告 / 测试报告 / 伤病报告三合一模块，支持指标自定义与 PDF 导出。
 */
export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-ams-text-secondary">加载中...</div>}>
      <ReportCenter />
    </Suspense>
  );
}
