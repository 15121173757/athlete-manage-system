'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, ClipboardList, Eye, ListChecks, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanAthlete {
  athlete: { id: number; name: string };
}

interface PlanItem {
  id: number;
  exercise: { id: number; name: string };
}

interface TrainingPlan {
  id: number;
  goal: string | null;
  status: string;
  createdAt: string;
  items: PlanItem[];
  planAthletes: PlanAthlete[];
}

const statusBadge: Record<string, string> = {
  DRAFT: 'bg-ams-surface-hover text-ams-text-secondary',
  SCHEDULED: 'bg-ams-primary/10 text-ams-primary',
  COMPLETED: 'bg-ams-success/10 text-ams-success',
};

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  SCHEDULED: '待执行',
  COMPLETED: '已执行',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN');
}

/**
 * 运动员详情页 —— 训练计划区块
 * 展示当前运动员关联的全部训练计划，点击可进入计划详情页
 */
export default function AthleteTrainingPlans({ athleteId }: { athleteId: number }) {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/training/plans?athleteId=${athleteId}&pageSize=50`);
      const json = await res.json();
      if (json.success) setPlans(json.data.plans);
      else setError(json.error?.message || '加载失败');
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return (
    <div className="ams-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-ams-primary" />
          <span className="font-medium text-ams-text-primary">训练计划</span>
          {!isLoading && !error && (
            <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
              {plans.length} 个
            </span>
          )}
        </div>
        <Link href="/training/plans" className="text-xs text-ams-primary hover:underline">
          查看全部
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-ams-text-secondary">加载中...</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-ams-danger">
          {error}
          <button type="button" className="ml-2 text-ams-primary underline" onClick={fetchPlans}>
            重试
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="py-8 text-center text-sm text-ams-text-secondary">
          暂无训练计划
          <p className="mt-1 text-xs text-ams-text-muted">可在「训练计划」模块为运动员创建并分配计划</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-ams border border-ams-border bg-ams-surface p-4 transition-colors hover:border-ams-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-ams-text-primary">
                      {plan.goal || `训练计划 #${plan.id}`}
                    </h4>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusBadge[plan.status] || 'bg-ams-surface-hover text-ams-text-secondary'
                      }`}
                    >
                      {statusLabels[plan.status] || plan.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ams-text-muted">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(plan.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" />
                      {plan.items.length} 项
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {plan.planAthletes.length} 名运动员
                    </span>
                  </div>
                </div>
                <Link href={`/training/plans/${plan.id}`} className="shrink-0">
                  <Button variant="outline" size="sm">
                    <Eye className="h-3.5 w-3.5" />
                    查看
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
