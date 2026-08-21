'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import AttendanceView from '../components/AttendanceView';

/**
 * 出勤管理 —— /training/records
 * 运动员出勤记录与管理系统（出勤表管理 + 出勤报告）
 */
export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/training"
        className="inline-flex items-center gap-1.5 rounded-ams px-2 py-1 text-sm text-ams-text-secondary transition-colors hover:bg-ams-surface-hover hover:text-ams-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回体能训练管理
      </Link>

      <div className="ams-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-ams bg-ams-primary/15">
            <ClipboardCheck className="h-5 w-5 text-ams-primary" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-ams-text-primary">出勤管理</h2>
            <p className="mt-1 text-sm text-ams-text-secondary">
              基于每日训练计划自动生成出勤表，支持手动添加参训人员与出勤报告导出
            </p>
          </div>
        </div>
      </div>

      <AttendanceView />
    </div>
  );
}
