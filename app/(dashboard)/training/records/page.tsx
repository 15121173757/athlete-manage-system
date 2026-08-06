'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  User,
  Eye,
  ListChecks,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanItemSummary {
  planItemId: number;
  dayOfWeek: number;
  exerciseName: string;
  exerciseCategory: string;
  unit: string;
  sets: number;
  reps: number;
  load: number | null;
  duration: number | null;
  intensity: string | null;
  notes: string | null;
  recordCount: number;
  executedSets: number | null;
  executedReps: number | null;
}

interface CompletedPlanUnit {
  planId: number;
  planGoal: string | null;
  planStatus: string;
  completionTime: string;
  athleteId: number;
  athleteName: string;
  athleteSport: string;
  executionStart: string | null;
  executionEnd: string | null;
  plannedDuration: number;
  exerciseCount: number;
  plannedTotalSets: number;
  plannedTotalReps: number;
  items: PlanItemSummary[];
}

const intensityBadge: Record<string, string> = {
  低: 'bg-ams-success/15 text-ams-success',
  中: 'bg-ams-primary/15 text-ams-primary',
  高: 'bg-ams-danger/15 text-ams-danger',
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('zh-CN');
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return '未记录执行日期';
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) return formatDate(start);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

function PlanUnitCard({ unit }: { unit: CompletedPlanUnit }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ams-card p-5">
      {/* 计划头信息 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-ams-text-primary truncate">
              {unit.planGoal || `训练计划 #${unit.planId}`}
            </h4>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ams-success/15 px-2.5 py-0.5 text-xs font-medium text-ams-success">
              <CheckCircle2 className="h-3 w-3" />
              已完成
            </span>
          </div>
          <p className="mt-1 text-xs text-ams-text-muted">
            完成于 {formatDate(unit.completionTime)}
          </p>
        </div>
        <Link href={`/training/plans/${unit.planId}`} className="shrink-0">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4" />
            查看详情
          </Button>
        </Link>
      </div>

      {/* 概览指标 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-ams bg-ams-surface border border-ams-border px-3 py-2.5">
          <div className="flex items-center gap-1 text-xs text-ams-text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            执行日期
          </div>
          <div className="mt-1 text-sm font-medium text-ams-text-primary">
            {formatDateRange(unit.executionStart, unit.executionEnd)}
          </div>
        </div>
        <div className="rounded-ams bg-ams-surface border border-ams-border px-3 py-2.5">
          <div className="flex items-center gap-1 text-xs text-ams-text-muted">
            <Clock className="h-3.5 w-3.5" />
            预计时长
          </div>
          <div className="mt-1 text-sm font-medium text-ams-text-primary">
            {unit.plannedDuration > 0 ? `${unit.plannedDuration} 分钟` : '未设置'}
          </div>
        </div>
        <div className="rounded-ams bg-ams-surface border border-ams-border px-3 py-2.5">
          <div className="flex items-center gap-1 text-xs text-ams-text-muted">
            <ListChecks className="h-3.5 w-3.5" />
            练习项目
          </div>
          <div className="mt-1 text-sm font-medium text-ams-text-primary">
            {unit.exerciseCount} 项
          </div>
        </div>
        <div className="rounded-ams bg-ams-surface border border-ams-border px-3 py-2.5">
          <div className="flex items-center gap-1 text-xs text-ams-text-muted">
            <RotateCcw className="h-3.5 w-3.5" />
            计划组 × 次
          </div>
          <div className="mt-1 text-sm font-medium text-ams-text-primary">
            {unit.plannedTotalSets} × {unit.plannedTotalReps}
          </div>
        </div>
      </div>

      {/* 项目明细（可展开） */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-ams border border-ams-border bg-ams-surface/60 px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:bg-ams-surface"
      >
        <span>项目明细</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-3 overflow-x-auto rounded-ams border border-ams-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ams-border bg-ams-surface/60">
                <th className="px-3 py-2 text-left ams-table-header">训练项目</th>
                <th className="px-3 py-2 text-left ams-table-header">计划组 × 次</th>
                <th className="px-3 py-2 text-left ams-table-header">负荷</th>
                <th className="px-3 py-2 text-left ams-table-header">时长</th>
                <th className="px-3 py-2 text-left ams-table-header">强度</th>
                <th className="px-3 py-2 text-left ams-table-header">执行记录</th>
                <th className="px-3 py-2 text-left ams-table-header">备注</th>
              </tr>
            </thead>
            <tbody>
              {unit.items.map((item) => (
                <tr key={item.planItemId} className="border-b border-ams-border/50 last:border-b-0">
                  <td className="px-3 py-2 text-ams-text-primary">{item.exerciseName}</td>
                  <td className="px-3 py-2 text-ams-text-secondary">
                    {item.sets} × {item.reps}
                  </td>
                  <td className="px-3 py-2 text-ams-text-secondary">
                    {item.load != null ? `${item.load} ${item.unit}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-ams-text-secondary">
                    {item.duration ? `${item.duration} 分钟` : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {item.intensity ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${intensityBadge[item.intensity] || 'bg-ams-surface text-ams-text-secondary'}`}>
                        {item.intensity}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-ams-text-secondary">
                    {item.recordCount > 0 ? (
                      <span className="text-ams-success">
                        {item.executedSets} × {item.executedReps}
                        <span className="text-ams-text-muted">（{item.recordCount} 条记录）</span>
                      </span>
                    ) : (
                      <span className="text-ams-text-muted">未执行</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ams-text-secondary max-w-[180px] truncate">
                    {item.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TrainingRecordsPage() {
  const [units, setUnits] = useState<CompletedPlanUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [athletes, setAthletes] = useState<{ id: number; name: string }[]>([]);

  // 筛选与排序
  const [athleteFilter, setAthleteFilter] = useState('');
  const [sortBy, setSortBy] = useState<'completionTime' | 'athleteName'>('completionTime');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ sortBy, sortOrder });
      if (athleteFilter) params.set('athleteId', athleteFilter);
      const res = await fetch(`/api/training/plan-records?${params}`);
      const json = await res.json();
      if (json.success) setUnits(json.data.units);
      else setError(json.error?.message || '加载失败');
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, [athleteFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    fetch('/api/athletes?pageSize=100').then(r => r.json()).then(j => {
      if (j.success) setAthletes(j.data.athletes);
    });
  }, []);

  // 按运动员分组，呈现计划层级结构
  const groups = useMemo(() => {
    const map = new Map<number, { athleteId: number; athleteName: string; athleteSport: string; units: CompletedPlanUnit[] }>();
    for (const u of units) {
      const g = map.get(u.athleteId);
      if (g) g.units.push(u);
      else map.set(u.athleteId, { athleteId: u.athleteId, athleteName: u.athleteName, athleteSport: u.athleteSport, units: [u] });
    }
    return Array.from(map.values());
  }, [units]);

  const resetFilters = () => {
    setAthleteFilter('');
    setSortBy('completionTime');
    setSortOrder('desc');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">训练记录</h2>
        <Button>
          <Plus className="h-4 w-4" />
          录入记录
        </Button>
      </div>

      {/* 筛选与排序 */}
      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={athleteFilter}
            onChange={(e) => setAthleteFilter(e.target.value)}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部运动员</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'completionTime' | 'athleteName')}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="completionTime">按完成时间排序</option>
            <option value="athleteName">按运动员姓名排序</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
          <Button variant="outline" size="sm" onClick={resetFilters}>重置</Button>
          <span className="ml-auto text-sm text-ams-text-muted">
            共 {units.length} 个已完成计划单元
          </span>
        </div>
      </div>

      {/* 分组内容 */}
      {isLoading ? (
        <div className="ams-card p-8 text-center text-ams-text-secondary">加载中...</div>
      ) : error ? (
        <div className="ams-card p-8 text-center text-ams-danger">{error}</div>
      ) : groups.length === 0 ? (
        <div className="ams-card p-8 text-center text-ams-text-secondary">
          暂无已完成的训练计划，完成训练计划后将在此按运动员分组展示。
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.athleteId} className="space-y-3">
              {/* 运动员分组标题 */}
              <div className="flex items-center gap-2 px-1">
                <User className="h-4 w-4 text-ams-primary" />
                <h3 className="font-semibold text-ams-text-primary">{g.athleteName}</h3>
                {g.athleteSport && (
                  <span className="text-xs text-ams-text-muted">{g.athleteSport}</span>
                )}
                <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                  {g.units.length} 个完成计划
                </span>
              </div>
              {g.units.map((u) => (
                <PlanUnitCard key={`${u.athleteId}-${u.planId}`} unit={u} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
