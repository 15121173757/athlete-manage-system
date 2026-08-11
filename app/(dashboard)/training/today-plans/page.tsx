'use client';

/**
 * 今日计划 —— /training/today-plans
 * 展示当日所有拥有训练计划的用户列表（基本信息、训练计划内容及时间安排）
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Clock,
  Dumbbell,
  Layers,
  UserRound,
  Users,
} from 'lucide-react';

interface TodayPlanItem {
  exerciseId: number;
  exerciseName: string;
  category: string;
  unit: string;
  sets: number;
  reps: number;
  load: number | null;
  restSeconds: number | null;
  duration: number | null;
  intensity: string | null;
  notes: string | null;
}

interface TodayPlanUnit {
  planId: number;
  goal: string | null;
  status: string;
  totalDuration: number;
  totalSets: number;
  totalReps: number;
  items: TodayPlanItem[];
}

interface TodayPlanAthlete {
  athleteId: number;
  name: string;
  sport: string;
  position: string | null;
  status: string;
  plans: TodayPlanUnit[];
}

interface TodayPlansResult {
  date: string;
  dayOfWeek: number;
  total: number;
  athletes: TodayPlanAthlete[];
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 运动员状态徽章 */
const ATHLETE_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: '在队', cls: 'border-ams-success/60 text-ams-success' },
  RESTING: { label: '休养', cls: 'border-ams-warning/60 text-ams-warning' },
  LEFT: { label: '离队', cls: 'border-ams-text-muted/60 text-ams-text-muted' },
};

/** 强度徽章 */
const INTENSITY_STYLE: Record<string, string> = {
  '低': 'border-ams-info/60 text-ams-info',
  '中': 'border-ams-warning/60 text-ams-warning',
  '高': 'border-ams-primary/60 text-ams-primary',
};

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function TodayPlansPage() {
  const [data, setData] = useState<TodayPlansResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/training/plans/today')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setData(j.data);
        else setError(j.message || '加载失败，请稍后重试');
      })
      .catch(() => {
        if (!cancelled) setError('网络异常，加载失败');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPlans = data?.athletes.reduce((s, a) => s + a.plans.length, 0) ?? 0;
  const totalItems = data?.athletes.reduce(
    (s, a) => s + a.plans.reduce((s2, p) => s2 + p.items.length, 0),
    0
  ) ?? 0;

  return (
    <div className="space-y-6">
      {/* 返回入口：回到数据看板首页（用户从看板卡片进入） */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-ams px-2 py-1 text-sm text-ams-text-secondary transition-colors hover:bg-ams-surface-hover hover:text-ams-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回数据看板
      </Link>

      {/* 标题区 */}
      <div className="ams-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-ams bg-ams-success/10">
                <CalendarDays className="h-5 w-5 text-ams-success" />
              </span>
              <h2 className="text-2xl font-bold text-ams-text-primary">今日计划</h2>
            </div>
            <p className="mt-2 text-sm text-ams-text-secondary">
              {data ? `${formatDate(data.date)} ${WEEKDAYS[(data.dayOfWeek - 1) % 7]} · 当日拥有训练计划的用户列表` : '加载中…'}
            </p>
          </div>
          {data && (
            <div className="flex flex-wrap gap-3">
              <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-ams-text-muted">
                  <Users className="h-3.5 w-3.5" />
                  今日有计划用户
                </div>
                <div className="mt-0.5 text-xl font-bold text-ams-success">{data.total}</div>
              </div>
              <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-ams-text-muted">
                  <ClipboardList className="h-3.5 w-3.5" />
                  覆盖训练计划
                </div>
                <div className="mt-0.5 text-xl font-bold text-ams-text-primary">{totalPlans}</div>
              </div>
              <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-ams-text-muted">
                  <Dumbbell className="h-3.5 w-3.5" />
                  今日计划项
                </div>
                <div className="mt-0.5 text-xl font-bold text-ams-text-primary">{totalItems}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-ams border border-dashed border-ams-border py-20 text-center">
          <CalendarDays className="mb-2 h-8 w-8 animate-pulse text-ams-text-muted" />
          <p className="text-sm text-ams-text-secondary">正在加载今日计划…</p>
        </div>
      ) : error ? (
        <div className="rounded-ams border border-ams-danger/40 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
          加载失败：{error}
        </div>
      ) : !data || data.athletes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-ams border border-dashed border-ams-border py-20 text-center">
          <CalendarDays className="mb-2 h-8 w-8 text-ams-text-muted" />
          <p className="text-sm text-ams-text-secondary">今日暂无训练计划安排</p>
          <p className="mt-1 text-xs text-ams-text-muted">发布训练计划并安排至对应星期后，将在此展示当日训练安排</p>
        </div>
      ) : (
        <div className="space-y-5">
          {data.athletes.map((athlete) => {
            const status = ATHLETE_STATUS[athlete.status] || ATHLETE_STATUS.ACTIVE;
            return (
              <section key={athlete.athleteId} className="ams-card overflow-hidden">
                {/* 用户信息头 */}
                <div className="flex flex-wrap items-center gap-3 border-b border-ams-border/60 bg-ams-background/40 px-5 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ams-primary/15 text-base font-bold text-ams-primary">
                    {athlete.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ams-text-primary">{athlete.name}</h3>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ams-text-muted">
                      <UserRound className="h-3 w-3" />
                      {athlete.sport || '未登记项目'}
                      {athlete.position ? ` · ${athlete.position}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-ams-text-muted">
                    {athlete.plans.length} 个训练计划 · 今日 {athlete.plans.reduce((s, p) => s + p.items.length, 0)} 项训练
                  </div>
                </div>

                {/* 训练计划明细 */}
                <div className="space-y-4 px-5 py-4">
                  {athlete.plans.map((plan) => (
                    <div key={plan.planId} className="rounded-ams border border-ams-border/50">
                      <div className="flex flex-wrap items-center gap-2 border-b border-ams-border/50 bg-ams-background/30 px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-ams-text-primary">
                          <Layers className="h-4 w-4 text-ams-primary" />
                          计划 #{plan.planId}
                        </span>
                        <span className="text-xs text-ams-text-secondary">
                          {plan.goal || '常规训练'}
                        </span>
                        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs text-ams-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            预计 {plan.totalDuration > 0 ? `${plan.totalDuration} 分钟` : '—'}
                          </span>
                          <span>{plan.items.length} 项 · {plan.totalSets} 组 · {plan.totalReps} 次</span>
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="ams-table-header">
                              <th className="px-4 py-2 text-left">#</th>
                              <th className="px-3 py-2 text-left">训练项目</th>
                              <th className="px-3 py-2 text-left">分类</th>
                              <th className="px-3 py-2 text-left">组 × 次</th>
                              <th className="px-3 py-2 text-left">负荷</th>
                              <th className="px-3 py-2 text-left">强度</th>
                              <th className="px-3 py-2 text-left">预计时长</th>
                              <th className="px-3 py-2 text-left">间歇</th>
                              <th className="px-3 py-2 text-left">备注</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.items.map((item, idx) => (
                              <tr key={item.exerciseId} className="border-t border-ams-border/50">
                                <td className="px-4 py-2.5 text-xs text-ams-text-muted">{idx + 1}</td>
                                <td className="px-3 py-2.5 font-medium text-ams-text-primary whitespace-nowrap">
                                  {item.exerciseName}
                                </td>
                                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                                  {item.category}
                                </td>
                                <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap">
                                  {item.sets} × {item.reps}
                                  {item.unit !== '次' ? `（${item.unit}）` : ''}
                                </td>
                                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                                  {item.load != null ? `${item.load} kg` : '—'}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {item.intensity ? (
                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${INTENSITY_STYLE[item.intensity] || 'border-ams-border/60 text-ams-text-secondary'}`}>
                                      {item.intensity}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                                  {item.duration != null ? `${item.duration} 分钟` : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                                  {item.restSeconds != null ? `${item.restSeconds} 秒` : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-ams-text-muted">{item.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
