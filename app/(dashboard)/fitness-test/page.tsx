'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  CalendarDays,
  MapPin,
  Users,
  FileText,
  Check,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentPlan {
  id: number;
  name: string;
  testDate: string;
  startTime: string | null;
  location: string | null;
  status: string;
  items: { id: number }[];
  participants: { id: number }[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-ams-text-secondary/10 text-ams-text-secondary' },
  SCHEDULED: { label: '待执行', color: 'bg-ams-primary/10 text-ams-primary' },
  COMPLETED: { label: '已执行', color: 'bg-ams-success/10 text-ams-success' },
};

export default function FitnessTestHomePage() {
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    scheduled: 0,
    completed: 0,
  });
  const [recentPlans, setRecentPlans] = useState<RecentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 并行拉取各状态的计划数量（pageSize=1 仅取 total），用于首页统计概览
    const fetchCount = (status?: string) =>
      fetch(
        status
          ? `/api/fitness/plans?pageSize=1&status=${status}`
          : '/api/fitness/plans?pageSize=1'
      )
        .then((r) => r.json())
        .then((j) => (j.success ? j.data.total : 0))
        .catch(() => 0);

    Promise.all([
      fetchCount(),
      fetchCount('DRAFT'),
      fetchCount('SCHEDULED'),
      fetchCount('COMPLETED'),
      fetch('/api/fitness/plans?page=1&pageSize=5')
        .then((r) => r.json())
        .catch(() => ({ success: false, data: null })),
    ])
      .then(([total, draft, scheduled, completed, recentRes]) => {
        setStats({ total, draft, scheduled, completed });
        const recent = recentRes as { success?: boolean; data?: { plans?: RecentPlan[] } };
        if (recent.success && recent.data?.plans) {
          setRecentPlans(recent.data.plans);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const statCards = [
    { label: '测试计划总数', value: stats.total, icon: ClipboardList, color: 'text-ams-primary' },
    { label: '草稿', value: stats.draft, icon: FileText, color: 'text-ams-text-secondary' },
    { label: '待执行', value: stats.scheduled, icon: CalendarDays, color: 'text-ams-primary' },
    { label: '已执行', value: stats.completed, icon: Check, color: 'text-ams-success' },
  ];

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ams-text-primary">体能测试管理</h1>
            <p className="text-xs text-ams-text-muted">测试计划制定、发布与执行跟踪</p>
          </div>
        </div>
        <Link href="/fitness-test/plans/new">
          <Button>
            <Plus className="h-4 w-4" />
            新建测试计划
          </Button>
        </Link>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="ams-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-ams-text-muted">{card.label}</div>
                  <div className={`mt-1 text-2xl font-semibold ${card.color}`}>
                    {isLoading ? '...' : card.value}
                  </div>
                </div>
                <Icon className={`h-6 w-6 ${card.color} opacity-70`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/fitness-test/plans" className="ams-card group p-4 transition-all hover:border-ams-primary hover:bg-ams-primary/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-ams-text-primary group-hover:text-ams-primary">测试计划列表</div>
              <div className="text-xs text-ams-text-muted">查看与管理全部测试计划</div>
            </div>
          </div>
        </Link>
        <Link href="/fitness-test/results" className="ams-card group p-4 transition-all hover:border-ams-primary hover:bg-ams-primary/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ams bg-ams-success/20 text-ams-success">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-ams-text-primary group-hover:text-ams-primary">测试成绩录入</div>
              <div className="text-xs text-ams-text-muted">为已执行的计划录入与管理成绩</div>
            </div>
          </div>
        </Link>
        <Link href="/fitness-test/analysis" className="ams-card group p-4 transition-all hover:border-ams-primary hover:bg-ams-primary/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-ams-text-primary group-hover:text-ams-primary">运动能力分析</div>
              <div className="text-xs text-ams-text-muted">测试成绩与常模对比，生成 TSA 综合评分</div>
            </div>
          </div>
        </Link>
        <Link href="/library?tab=tests" className="ams-card group p-4 transition-all hover:border-ams-primary hover:bg-ams-primary/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-ams-text-primary group-hover:text-ams-primary">测试库</div>
              <div className="text-xs text-ams-text-muted">管理测试项目与测试标准</div>
            </div>
          </div>
        </Link>
      </div>

      {/* 近期测试计划 */}
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ams-text-primary">近期测试计划</h2>
          <Link href="/fitness-test/plans" className="text-xs text-ams-primary hover:underline">
            查看全部
          </Link>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-ams-text-secondary text-sm">加载中...</div>
        ) : recentPlans.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            暂无测试计划，点击右上角「新建测试计划」开始
          </div>
        ) : (
          <div className="divide-y divide-ams-border/50">
            {recentPlans.map((p) => {
              const s = statusLabels[p.status] || { label: p.status, color: 'text-ams-text-secondary' };
              return (
                <Link
                  key={p.id}
                  href={`/fitness-test/plans/${p.id}`}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-ams-primary/5 px-2 -mx-2 rounded-ams"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ams-text-primary truncate">{p.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ams-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(p.testDate).toLocaleDateString('zh-CN')}
                        {p.startTime && ` ${p.startTime}`}
                      </span>
                      {p.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {p.items?.length || 0} 项
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {p.participants?.length || 0} 人
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
