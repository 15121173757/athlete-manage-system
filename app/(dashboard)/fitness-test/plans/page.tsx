'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, CalendarDays, MapPin, Users, ClipboardList, Eye, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FitnessPlanItem {
  id: number;
  testId: number;
  test: { id: number; name: string; category: string };
}

interface FitnessPlanParticipant {
  id: number;
  athleteId: number;
  athlete: { id: number; name: string };
}

interface FitnessPlan {
  id: number;
  name: string;
  testDate: string;
  startTime: string | null;
  estimatedDuration: number | null;
  location: string | null;
  weather: string | null;
  status: string;
  items: FitnessPlanItem[];
  participants: FitnessPlanParticipant[];
  createdBy: { id: number; name: string };
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-ams-text-secondary/10 text-ams-text-secondary' },
  SCHEDULED: { label: '待执行', color: 'bg-ams-primary/10 text-ams-primary' },
  COMPLETED: { label: '已执行', color: 'bg-ams-success/10 text-ams-success' },
};

export default function FitnessTestPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<FitnessPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/fitness/plans?${params}`);
      const json = await res.json();
      if (json.success) {
        setPlans(json.data.plans);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch {
      /* empty */
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /**
   * 整行点击导航：点击行内任意区域（"查看"链接除外）跳转至测试计划详情页。
   * 通过 closest 判断点击目标是否为可交互元素，避免与原有链接行为冲突。
   */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, id: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) return;
    router.push(`/fitness-test/plans/${id}`);
  };

  /**
   * 返回上级：测试计划列表的上一级固定为「体能测试管理」首页。
   * 使用 router.replace 直接导航到父级页面并替换当前历史条目：
   * 1) 路径由层级关系决定，不受浏览器历史影响，绝不会回退到
   *    新建页等兄弟页面形成「新建→列表→新建」导航循环；
   * 2) replace 不会在历史中追加重复条目，保证历史记录干净。
   */
  const handleBack = () => {
    router.replace('/fitness-test');
  };

  return (
    <div className="space-y-4">
      {/* 顶部工具条（sticky 固定在内容区顶部，滚动列表时不随内容移动） */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-ams-background/95 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="返回上一级"
            title="返回上一级"
            className="inline-flex items-center gap-1.5 rounded-ams px-2.5 py-1.5 text-sm font-medium text-ams-text-secondary transition-all duration-150 hover:scale-[1.04] hover:bg-ams-surface-hover hover:text-ams-text-primary active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </button>
          <h2 className="text-xl font-semibold text-ams-text-primary">测试计划</h2>
        </div>
        <Link href="/fitness-test/plans/new">
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
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
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
            暂无测试计划，点击右上角新建
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">计划名称</th>
                    <th className="px-4 py-3 text-left ams-table-header">测试日期</th>
                    <th className="px-4 py-3 text-left ams-table-header">地点</th>
                    <th className="px-4 py-3 text-left ams-table-header">参与人数</th>
                    <th className="px-4 py-3 text-left ams-table-header">测试项目数</th>
                    <th className="px-4 py-3 text-left ams-table-header">状态</th>
                    <th className="px-4 py-3 text-right ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const s = statusLabels[p.status] || {
                      label: p.status,
                      color: 'text-ams-text-secondary',
                    };
                    return (
                      <tr
                        key={p.id}
                        onClick={(e) => handleRowClick(e, p.id)}
                        className="cursor-pointer border-b border-ams-border/50 transition-colors duration-150 hover:bg-ams-primary/10"
                      >
                        <td className="px-4 py-3 text-ams-text-primary font-medium">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          <CalendarDays className="inline h-4 w-4 mr-1 text-ams-text-muted" />
                          {new Date(p.testDate).toLocaleDateString('zh-CN')}
                          {p.startTime && ` ${p.startTime}`}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          {p.location ? (
                            <span className="inline-flex items-center">
                              <MapPin className="h-4 w-4 mr-1 text-ams-text-muted" />
                              {p.location}
                            </span>
                          ) : (
                            <span className="text-ams-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          <Users className="inline h-4 w-4 mr-1 text-ams-text-muted" />
                          {p.participants?.length || 0}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          <ClipboardList className="inline h-4 w-4 mr-1 text-ams-text-muted" />
                          {p.items?.length || 0}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.color}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/fitness-test/plans/${p.id}`}
                            className="inline-flex items-center text-ams-primary hover:underline"
                          >
                            <Eye className="h-4 w-4 mr-1" />
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
                    onClick={() => setPage(1)}
                  >
                    回首页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="flex items-center text-sm text-ams-text-secondary px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
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
