'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 详情页「返回列表」来源记录键 */
const PLAN_RETURN_KEY = 'ams-plan-list-return';

interface TrainingPlan {
  id: number;
  goal: string | null;
  status: string;
  startDate: string | null;
  startTime: string | null;
  planAthletes: { athlete: { id: number; name: string } }[];
  coach: { id: number; name: string };
  items: Array<{ id: number }>;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'text-ams-text-secondary' },
  SCHEDULED: { label: '待执行', color: 'text-ams-primary' },
  COMPLETED: { label: '已执行', color: 'text-ams-success' },
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 执行时间展示格式：YYYY-MM-DD-周X HH:MM（星期按北京时间计算，与 UTC 零点日期一致） */
function formatExecuteTime(p: { startDate: string | null; startTime: string | null }): string {
  if (!p.startDate) return '-';
  const dateStr = p.startDate.slice(0, 10);
  const weekday = WEEKDAYS[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];
  return `${dateStr}-${weekday} ${p.startTime || ''}`.trim();
}

/** 今日北京时间日期（YYYY-MM-DD），用于高亮展示今日计划 */
function getBeijingToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function TrainingPlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 列表状态（筛选/分页）由 URL 驱动，返回列表时可完整恢复
  const statusFilter = searchParams.get('status') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const todayStr = getBeijingToday();

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/training/plans?${params}`);
      const json = await res.json();
      if (json.success) {
        setPlans(json.data.plans);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  /** 将筛选/分页状态同步到 URL */
  const updateQuery = (next: { status?: string; page?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    if (next.page !== undefined) params.set('page', next.page);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  /** 进入详情前记录来源列表 URL（含筛选/分页状态） */
  const goDetail = (id: number) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PLAN_RETURN_KEY, window.location.href);
    }
    router.push(`/training/plans/${id}`);
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, id: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) return;
    goDetail(id);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('status', value);
    else params.delete('status');
    params.delete('page');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">训练计划</h2>
        <Link href="/training/plans/new">
          <Button>
            <Plus className="h-4 w-4" />
            新建计划
          </Button>
        </Link>
      </div>

      <div className="ams-card p-4">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="SCHEDULED">待执行</option>
            <option value="COMPLETED">已执行</option>
          </select>
        </div>
      </div>

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">
            暂无训练计划，点击右上角新建
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">运动员</th>
                    <th className="px-4 py-3 text-left ams-table-header">目标</th>
                    <th className="px-4 py-3 text-left ams-table-header">执行时间</th>
                    <th className="px-4 py-3 text-left ams-table-header">状态</th>
                    <th className="px-4 py-3 text-left ams-table-header">教练</th>
                    <th className="px-4 py-3 text-right ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const s = statusLabels[p.status] || { label: p.status, color: 'text-ams-text-secondary' };
                    // 今日计划高亮：执行日期为北京时间今天
                    const isToday = p.startDate ? p.startDate.slice(0, 10) === todayStr : false;
                    return (
                      <tr
                        key={p.id}
                        onClick={(e) => handleRowClick(e, p.id)}
                        className={`cursor-pointer border-b border-ams-border/50 transition-colors duration-150 ${
                          isToday
                            ? 'border-l-4 border-l-ams-warning bg-ams-warning/20 hover:bg-ams-warning/25'
                            : 'border-l-4 border-l-transparent hover:bg-ams-primary/10'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.planAthletes.map((pa) => (
                              <span key={pa.athlete.id} className="inline-flex items-center rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs text-ams-primary">
                                {pa.athlete.name}
                              </span>
                            ))}
                            {p.planAthletes.length > 3 && (
                              <span className="inline-flex items-center rounded-full bg-ams-surface px-2 py-0.5 text-xs text-ams-text-muted">
                                +{p.planAthletes.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary max-w-[200px] truncate">{p.goal || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-ams-text-secondary">
                          {isToday && (
                            <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-ams-warning px-2 py-1 text-xs font-bold leading-none text-ams-background">
                              <CalendarDays className="h-3.5 w-3.5" />
                              今日
                            </span>
                          )}
                          <span className={isToday ? 'font-semibold text-ams-warning' : undefined}>
                            {formatExecuteTime(p)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${s.color}`}>{s.label}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">{p.coach.name}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/training/plans/${p.id}`}
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                sessionStorage.setItem(PLAN_RETURN_KEY, window.location.href);
                              }
                            }}
                            className="text-ams-primary hover:underline"
                          >
                            查看
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ams-border px-4 py-3">
                <div className="text-sm text-ams-text-secondary">共 {total} 条</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateQuery({ page: '1' })}
                  >
                    回首页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateQuery({ page: String(page - 1) })}
                  >
                    上一页
                  </Button>
                  <span className="flex items-center text-sm text-ams-text-secondary px-2">{page} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => updateQuery({ page: String(page + 1) })}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TrainingPlansPage() {
  return (
    <Suspense>
      <TrainingPlansContent />
    </Suspense>
  );
}
