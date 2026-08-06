'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  CloudSun,
  Building2,
  StickyNote,
  Users,
  Package,
  Trash2,
  Check,
  X,
  Dumbbell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanItem {
  id: number;
  testId: number;
  sortOrder: number;
  allocatedMinutes: number | null;
  equipmentReady: boolean;
  test: { id: number; name: string; category: string; unit: string; equipment: string | null };
}

interface PlanParticipant {
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
  venueCondition: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  items: PlanItem[];
  participants: PlanParticipant[];
  createdBy: { id: number; name: string };
}

interface EquipmentSummaryItem {
  name: string;
  count: number;
  ready: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-ams-text-secondary/10 text-ams-text-secondary' },
  SCHEDULED: { label: '已安排', color: 'bg-ams-primary/10 text-ams-primary' },
  COMPLETED: { label: '已完成', color: 'bg-ams-success/10 text-ams-success' },
  CANCELLED: { label: '已取消', color: 'bg-ams-danger/10 text-ams-danger' },
};

const categoryIcons: Record<string, React.ReactNode> = {
  力量: <Dumbbell className="h-4 w-4" />,
  爆发力: <Dumbbell className="h-4 w-4" />,
  速度: <Clock className="h-4 w-4" />,
  耐力: <Clock className="h-4 w-4" />,
};

export default function FitnessPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<FitnessPlan | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [itemReadyState, setItemReadyState] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    fetch(`/api/fitness/plans/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setPlan(json.data);
          const readyMap: Record<number, boolean> = {};
          for (const item of json.data.items || []) {
            readyMap[item.id] = !!item.equipmentReady;
          }
          setItemReadyState(readyMap);
        } else {
          setError(json.error?.message || '加载失败');
        }
      })
      .catch(() => setError('网络错误，请稍后重试'))
      .finally(() => setIsLoading(false));

    fetch(`/api/fitness/plans/${id}/equipment`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setEquipment(json.data);
      })
      .catch(() => {
        /* 器材汇总加载失败不阻塞主流程 */
      });
  }, [params.id]);

  const toggleEquipmentReady = (itemId: number) => {
    setItemReadyState((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (
      !confirm(
        `确定删除体能测试计划「${plan.name}」？此操作不可撤销。`
      )
    )
      return;
    try {
      const res = await fetch(`/api/fitness/plans/${plan.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        router.push('/fitness/plans');
      } else {
        alert(json.error?.message || '删除失败');
      }
    } catch {
      alert('网络错误，请稍后重试');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ams-text-secondary">
        加载中...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/fitness/plans">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
          </Link>
        </div>
        <div className="ams-card py-16 text-center text-ams-text-secondary">
          {error || '体能测试计划不存在'}
        </div>
      </div>
    );
  }

  const statusInfo = statusLabels[plan.status] || {
    label: plan.status,
    color: 'bg-ams-surface text-ams-text-secondary',
  };

  const sortedItems = [...plan.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const readyCount = sortedItems.filter((i) => itemReadyState[i.id]).length;

  return (
    <div className="space-y-6">
      {/* 头部操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/fitness/plans">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
          </Link>
          <h2 className="text-xl font-semibold text-ams-text-primary">
            体能测试计划详情
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="text-ams-danger border-ams-danger/30 hover:bg-ams-danger/10"
        >
          <Trash2 className="h-4 w-4" />
          删除
        </Button>
      </div>

      {/* 计划信息卡片 */}
      <div className="ams-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
              <h3 className="text-lg font-semibold text-ams-text-primary">
                {plan.name}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-ams-text-secondary">
                <CalendarDays className="h-4 w-4 text-ams-text-muted shrink-0" />
                <span>
                  {new Date(plan.testDate).toLocaleDateString('zh-CN')}
                  {plan.startTime && ` ${plan.startTime}`}
                </span>
              </div>
              {plan.estimatedDuration !== null && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <Clock className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>预计 {plan.estimatedDuration} 分钟</span>
                </div>
              )}
              {plan.location && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <MapPin className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>{plan.location}</span>
                </div>
              )}
              {plan.weather && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <CloudSun className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>{plan.weather}</span>
                </div>
              )}
              {plan.venueCondition && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <Building2 className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>{plan.venueCondition}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-ams-text-secondary">
                <Users className="h-4 w-4 text-ams-text-muted shrink-0" />
                <span>创建人：{plan.createdBy?.name || '-'}</span>
              </div>
            </div>
            {plan.notes && (
              <div className="flex items-start gap-2 mt-2 pt-3 border-t border-ams-border">
                <StickyNote className="h-4 w-4 text-ams-primary mt-0.5 shrink-0" />
                <p className="text-sm text-ams-text-secondary">{plan.notes}</p>
              </div>
            )}
          </div>
          <div className="text-right text-sm text-ams-text-muted shrink-0">
            <div>共 {plan.items.length} 个测试项目</div>
            <div>{plan.participants.length} 名参与人员</div>
            {plan.createdAt && (
              <div className="text-xs mt-1">
                创建于 {new Date(plan.createdAt).toLocaleDateString('zh-CN')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 测试项目列表 */}
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ams-text-primary">
            测试项目
          </h3>
          <span className="text-xs text-ams-text-muted">
            器材已就绪 {readyCount} / {sortedItems.length}
          </span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            暂无测试项目
          </div>
        ) : (
          <div className="space-y-2">
            {sortedItems.map((item, idx) => {
              const ready = !!itemReadyState[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-ams border border-ams-border p-3 hover:border-ams-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary text-xs font-medium shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-ams bg-ams-surface text-ams-primary shrink-0">
                      {categoryIcons[item.test.category] || (
                        <Dumbbell className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ams-text-primary">
                          {item.test.name}
                        </span>
                        <span className="text-xs text-ams-text-muted">
                          {item.test.category}
                          {item.test.unit && ` · ${item.test.unit}`}
                        </span>
                      </div>
                      {item.allocatedMinutes !== null && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-ams-text-secondary">
                          <Clock className="h-3 w-3" />
                          分配时间 {item.allocatedMinutes} 分钟
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEquipmentReady(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        ready
                          ? 'bg-ams-success/10 text-ams-success hover:bg-ams-success/20'
                          : 'bg-ams-warning/10 text-ams-warning hover:bg-ams-warning/20'
                      }`}
                    >
                      {ready ? (
                        <>
                          <Check className="h-3 w-3" />
                          器材就绪
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          未就绪
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 参与人员 */}
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ams-text-primary">
            参与人员
          </h3>
          <span className="text-xs text-ams-text-muted">
            共 {plan.participants.length} 人
          </span>
        </div>

        {plan.participants.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            暂无参与人员
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {plan.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-ams border border-ams-border bg-ams-surface p-2.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ams-primary/20 text-ams-primary text-xs font-medium shrink-0">
                  {p.athlete.name.charAt(0)}
                </div>
                <span className="text-sm text-ams-text-primary truncate">
                  {p.athlete.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 器材汇总 */}
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ams-text-primary">
            器材汇总
          </h3>
          <span className="text-xs text-ams-text-muted">
            共 {equipment.length} 类器材
          </span>
        </div>

        {equipment.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
            暂无器材需求
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {equipment.map((eq) => (
              <div
                key={eq.name}
                className="flex items-center justify-between rounded-ams border border-ams-border bg-ams-surface p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-ams-primary shrink-0" />
                  <span className="text-sm text-ams-text-primary truncate">
                    {eq.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="rounded-full bg-ams-primary/20 px-2 py-0.5 text-xs font-medium text-ams-primary">
                    ×{eq.count}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      eq.ready
                        ? 'bg-ams-success/10 text-ams-success'
                        : 'bg-ams-warning/10 text-ams-warning'
                    }`}
                  >
                    {eq.ready ? '就绪' : '未就绪'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
