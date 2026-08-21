'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Activity, TrendingUp, AlertTriangle, ChevronRight, Search, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { riskStyles } from './riskStyles';
import { LoadBarChart } from './LoadBarChart';

/** 详情页「返回列表」来源记录键：进入运动员负荷详情前保存来源 URL（保留 tab 状态） */
const LOAD_RETURN_KEY = 'ams-load-return';

/** 运动员选择状态本地存储键（选择记忆） */
const SELECTION_KEY = 'ams-load-monitor-selected-athletes';

/** 概览默认展示的运动员数量 */
const DEFAULT_DISPLAY_COUNT = 12;

interface AthleteLoadOverview {
  athleteId: number;
  athleteName: string;
  dates: string[];
  dailyLoads: number[];
  acuteLoad: number;
  chronicLoad: number;
  acwr: number | null;
  riskLevel: 'LOW' | 'SAFE' | 'ELEVATED' | 'HIGH' | 'NO_DATA';
  recordCount: number;
}

interface LoadRecord {
  id: number;
  athleteId: number;
  recordDate: string;
  rpe: number;
  durationMinutes: number;
  trainingType: string | null;
  notes: string | null;
  athlete: { id: number; name: string };
}

interface Athlete {
  id: number;
  name: string;
  sport?: string;
}

/** 进入详情前记录来源 URL，供详情页「返回」恢复 */
const goAthleteDetail = (athleteId: number) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(LOAD_RETURN_KEY, window.location.href);
  }
};

export default function LoadMonitorView() {
  const [overview, setOverview] = useState<AthleteLoadOverview[]>([]);
  const [records, setRecords] = useState<LoadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [athleteFilter, setAthleteFilter] = useState('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 概览运动员选择状态
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  // 录入弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [formAthlete, setFormAthlete] = useState('');
  const [formTeamFilter, setFormTeamFilter] = useState('');
  const [formSearch, setFormSearch] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRpe, setFormRpe] = useState<number>(6);
  const [formDuration, setFormDuration] = useState('');
  const [formTrainingType, setFormTrainingType] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (athleteFilter) params.set('athleteId', athleteFilter);

      const res = await fetch(`/api/health/load?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || `请求失败（${res.status}）`);
      }
      setOverview(json.data.overview || []);
      setRecords(json.data.records || []);
      setTotal(json.data.total || 0);
      setTotalPages(json.data.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载负荷数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [page, athleteFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 加载运动员列表（用于选择器与筛选下拉，需覆盖全部运动员）
  useEffect(() => {
    fetch('/api/athletes?pageSize=1000')
      .then((r) => r.json())
      .then((j) => { if (j.success) setAthletes(j.data.athletes || []); })
      .catch(() => {});
  }, []);

  // 初始化概览运动员选择：优先从本地存储恢复；否则默认「有负荷优先，补足到 12 个」
  useEffect(() => {
    if (selectionInitialized) return;
    if (athletes.length === 0 || isLoading) return;

    // 有效运动员 ID 集合（过滤已删除运动员）
    const validIds = new Set(athletes.map((a) => a.id));

    // 1. 尝试从本地存储恢复选择
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      if (raw) {
        const saved: number[] = JSON.parse(raw);
        if (Array.isArray(saved)) {
          const filtered = saved.filter((id) => validIds.has(id));
          if (filtered.length > 0) {
            setSelectedIds(filtered);
            setSelectionInitialized(true);
            return;
          }
        }
      }
    } catch {
      /* 忽略本地存储异常，走默认选择 */
    }

    // 2. 默认：有负荷记录优先（保持 overview 的 ACWR 降序），不足补无负荷运动员
    const withLoadIds = overview.map((o) => o.athleteId).filter((id) => validIds.has(id));
    const withLoadSet = new Set(withLoadIds);
    const withoutLoadIds = athletes
      .filter((a) => !withLoadSet.has(a.id))
      .map((a) => a.id);
    const defaultIds = [...withLoadIds, ...withoutLoadIds].slice(0, DEFAULT_DISPLAY_COUNT);
    setSelectedIds(defaultIds);
    setSelectionInitialized(true);
  }, [athletes, overview, isLoading, selectionInitialized]);

  // ---- 录入负荷 ----
  const handleAdd = async () => {
    setAddMsg('');
    if (!formAthlete) { setAddMsg('请选择运动员'); return; }
    if (!formDate) { setAddMsg('请选择训练日期'); return; }
    if (!formRpe || formRpe < 1 || formRpe > 10) { setAddMsg('请选择 RPE（1-10）'); return; }
    const duration = parseInt(formDuration, 10);
    if (!duration || duration <= 0) { setAddMsg('请输入大于 0 的训练时长（分钟）'); return; }

    setIsSaving(true);
    try {
      const res = await fetch('/api/health/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId: parseInt(formAthlete, 10),
          recordDate: formDate,
          rpe: formRpe,
          durationMinutes: duration,
          trainingType: formTrainingType || undefined,
          notes: formNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || '保存失败');
      }
      setShowModal(false);
      setFormAthlete('');
      setFormDuration('');
      setFormTrainingType('');
      setFormNotes('');
      setPage(1);
      fetchData();
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const riskCount = (level: AthleteLoadOverview['riskLevel']) =>
    overview.filter((o) => o.riskLevel === level).length;

  // ---- 概览运动员选择 ----

  /** 持久化选择状态到本地存储 */
  const persistSelection = (ids: number[]) => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(ids));
    } catch {
      /* 忽略本地存储异常 */
    }
  };

  // 概览展示数据：将「选中运动员」与「有负荷概览」关联，无负荷者以空占位卡片呈现
  const overviewMap = useMemo(
    () => new Map(overview.map((o) => [o.athleteId, o])),
    [overview]
  );

  /**
   * 展示排序规则：有完整 ACWR 数据的运动员优先（按 ACWR 数值降序），
   * 无 ACWR 数据的运动员统一排在后面（按姓名升序）
   */
  const compareForDisplay = useCallback((a: Athlete, b: Athlete) => {
    const acwrA = overviewMap.get(a.id)?.acwr ?? null;
    const acwrB = overviewMap.get(b.id)?.acwr ?? null;
    if (acwrA === null && acwrB === null) return a.name.localeCompare(b.name, 'zh-CN');
    if (acwrA === null) return 1;
    if (acwrB === null) return -1;
    return acwrB - acwrA;
  }, [overviewMap]);

  // 队伍（运动项目）维度选项：按项目分组统计人数，供选择弹窗筛选
  const sportOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of athletes) {
      const s = a.sport || '未登记';
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([sport, count]) => ({ sport, count }))
      .sort((x, y) => x.sport.localeCompare(y.sport, 'zh-CN'));
  }, [athletes]);

  // 录入弹窗内运动员选项：队伍筛选 + 姓名搜索组合过滤，按姓名升序（不限训练计划，可选任意运动员）
  const formAthleteOptions = useMemo(() => {
    const q = formSearch.trim().toLowerCase();
    return athletes
      .filter((a) => !formTeamFilter || (a.sport || '未登记') === formTeamFilter)
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort((x, y) => x.name.localeCompare(y.name, 'zh-CN'));
  }, [athletes, formTeamFilter, formSearch]);

  // 选择弹窗内运动员列表：队伍筛选 + 姓名搜索组合过滤，并按展示排序规则排列
  const filteredAthletes = useMemo(() => {
    const q = selectorSearch.trim().toLowerCase();
    return athletes
      .filter((a) => !teamFilter || (a.sport || '未登记') === teamFilter)
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort(compareForDisplay);
  }, [athletes, teamFilter, selectorSearch, compareForDisplay]);

  // 已选运动员（按展示排序规则：有 ACWR 数据优先、ACWR 降序，无数据在后）
  const selectedAthletes = useMemo(
    () => athletes.filter((a) => selectedIds.includes(a.id)).sort(compareForDisplay),
    [athletes, selectedIds, compareForDisplay]
  );

  // 已选运动员中有负荷记录的人数（用于标题反馈）
  const selectedWithLoadCount = selectedAthletes.filter((a) => overviewMap.has(a.id)).length;

  /** 切换单个运动员的选中状态 */
  const toggleSelect = (athleteId: number) => {
    setSelectedIds((prev) => {
      const next = prev.includes(athleteId)
        ? prev.filter((id) => id !== athleteId)
        : [...prev, athleteId];
      persistSelection(next);
      return next;
    });
  };

  /** 全选：选中当前筛选（队伍 + 搜索）下的全部运动员；无筛选时即全部运动员 */
  const selectAll = () => {
    const all = filteredAthletes.map((a) => a.id);
    setSelectedIds(all);
    persistSelection(all);
  };

  /** 清空：取消全部选择 */
  const clearSelection = () => {
    setSelectedIds([]);
    persistSelection([]);
  };

  return (
    <div className="space-y-4">
      {/* 概览统计 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="ams-card p-4">
          <div className="text-xs text-ams-text-muted">监控运动员</div>
          <div className="mt-1 text-2xl font-semibold text-ams-text-primary">{overview.length}</div>
          <div className="mt-1 text-xs text-ams-text-muted">近 28 天有负荷记录</div>
        </div>
        <div className="ams-card p-4">
          <div className="text-xs text-ams-text-muted">高风险运动员</div>
          <div className="mt-1 text-2xl font-semibold text-ams-danger">{riskCount('HIGH')}</div>
          <div className="mt-1 text-xs text-ams-text-muted">ACWR &gt; 1.5，需立即干预</div>
        </div>
        <div className="ams-card p-4">
          <div className="text-xs text-ams-text-muted">风险升高</div>
          <div className="mt-1 text-2xl font-semibold text-ams-primary">{riskCount('ELEVATED')}</div>
          <div className="mt-1 text-xs text-ams-text-muted">ACWR 1.3-1.5，需关注</div>
        </div>
        <div className="ams-card p-4">
          <div className="text-xs text-ams-text-muted">负荷不足</div>
          <div className="mt-1 text-2xl font-semibold text-ams-success">{riskCount('LOW')}</div>
          <div className="mt-1 text-xs text-ams-text-muted">ACWR &lt; 0.8，训练量偏低</div>
        </div>
      </div>

      {/* 运动员 ACWR 概览卡片 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-medium text-ams-text-primary">运动员负荷概览（近 28 天）</h3>
            <span className="rounded-full bg-ams-surface-hover px-2 py-0.5 text-xs text-ams-text-muted">
              已选 {selectedIds.length} 人 · 有负荷 {selectedWithLoadCount} 人
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowSelector(true)}>
              <Users className="h-4 w-4" />
              选择运动员
            </Button>
            <Button size="sm" onClick={() => { setAddMsg(''); setFormTeamFilter(''); setFormSearch(''); setFormAthlete(''); setShowModal(true); }}>
              <Plus className="h-4 w-4" />
              录入负荷
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="ams-card p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : error ? (
          <div className="ams-card p-8 text-center text-ams-danger">{error}</div>
        ) : selectedAthletes.length === 0 ? (
          <div className="ams-card p-10 text-center">
            <Activity className="mx-auto h-10 w-10 text-ams-text-muted" />
            <p className="mt-3 text-ams-text-secondary">暂未选择运动员</p>
            <p className="mt-1 text-sm text-ams-text-muted">
              请点击右上角「选择运动员」勾选需要展示负荷概览的运动员
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {selectedAthletes.map((a) => {
              const o = overviewMap.get(a.id);
              if (!o) {
                // 无负荷记录：空占位卡片
                return (
                  <div
                    key={a.id}
                    className="ams-card flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ams-surface-hover text-ams-text-muted">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-sm font-medium text-ams-text-primary">{a.name}</div>
                    <div className="mt-1 text-xs text-ams-text-muted">暂无负荷记录</div>
                  </div>
                );
              }

              const risk = riskStyles[o.riskLevel];
              return (
                <Link
                  key={o.athleteId}
                  href={`/health/load/${o.athleteId}`}
                  onClick={() => goAthleteDetail(o.athleteId)}
                  className="ams-card ams-card-hover block p-4 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ams-text-primary">{o.athleteName}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ams-text-muted" />
                      </div>
                      <div className="mt-0.5 text-xs text-ams-text-muted">
                        记录 {o.recordCount} 条 · 最近 28 天
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${risk.badge}`}>
                      {risk.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end gap-6">
                    <div>
                      <div className={`text-3xl font-bold ${o.acwr === null ? 'text-ams-text-muted' : risk.text}`}>
                        {o.acwr === null ? '—' : o.acwr.toFixed(2)}
                      </div>
                      <div className="mt-1 text-xs text-ams-text-muted">ACWR 急慢性负荷比</div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-ams-text-muted">急性负荷（近7天 EWMA）</span>
                        <span className="font-medium text-ams-text-primary">{Math.round(o.acuteLoad)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-ams-text-muted">慢性负荷（近28天 EWMA）</span>
                        <span className="font-medium text-ams-text-primary">{Math.round(o.chronicLoad)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <LoadBarChart loads={o.dailyLoads} />
                    <div className="mt-1 flex justify-between text-[10px] text-ams-text-muted">
                      <span>{o.dates[0]?.slice(5)}</span>
                      <span>{o.dates[o.dates.length - 1]?.slice(5)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 负荷记录列表 */}
      <div className="ams-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ams-border px-4 py-3">
          <h3 className="text-sm font-medium text-ams-text-primary">负荷记录</h3>
          <select
            value={athleteFilter}
            onChange={(e) => { setAthleteFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-1.5 text-sm text-ams-text-primary"
          >
            <option value="">全部运动员</option>
            {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ams-border">
                <th className="px-4 py-3 text-left ams-table-header">日期</th>
                <th className="px-4 py-3 text-left ams-table-header">运动员</th>
                <th className="px-4 py-3 text-left ams-table-header">训练类型</th>
                <th className="px-4 py-3 text-left ams-table-header">RPE</th>
                <th className="px-4 py-3 text-left ams-table-header">时长（分钟）</th>
                <th className="px-4 py-3 text-left ams-table-header">训练量</th>
                <th className="px-4 py-3 text-left ams-table-header">备注</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ams-text-muted">暂无负荷记录</td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
                    <td className="px-4 py-3 text-ams-text-primary">
                      {new Date(r.recordDate).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-ams-text-secondary">{r.athlete.name}</td>
                    <td className="px-4 py-3">
                      {r.trainingType ? (
                        <span className="inline-flex items-center rounded-full bg-ams-surface-hover px-2 py-0.5 text-xs text-ams-text-secondary">
                          {r.trainingType}
                        </span>
                      ) : (
                        <span className="text-ams-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-ams-surface-hover px-2 py-0.5 text-xs font-medium text-ams-text-primary">
                        {r.rpe}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ams-text-secondary">{r.durationMinutes}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ams-primary">{r.rpe * r.durationMinutes}</span>
                      <span className="ml-1 text-xs text-ams-text-muted">AU</span>
                    </td>
                    <td className="px-4 py-3 text-ams-text-muted max-w-[160px] truncate">{r.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ams-border px-4 py-3">
            <div className="text-sm text-ams-text-secondary">共 {total} 条</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 录入负荷弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-ams-lg bg-ams-surface border border-ams-border p-6 shadow-ams-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ams-text-primary">录入训练负荷</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-ams-text-muted hover:text-ams-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">队伍</label>
                <select
                  value={formTeamFilter}
                  onChange={(e) => { setFormTeamFilter(e.target.value); setFormAthlete(''); }}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                >
                  <option value="">全部队伍</option>
                  {sportOptions.map((s) => (
                    <option key={s.sport} value={s.sport}>{s.sport}（{s.count}人）</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">运动员搜索</label>
                <input
                  type="text"
                  value={formSearch}
                  onChange={(e) => { setFormSearch(e.target.value); setFormAthlete(''); }}
                  placeholder="输入姓名快速查找..."
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">运动员</label>
                <select
                  value={formAthlete}
                  onChange={(e) => setFormAthlete(e.target.value)}
                  disabled={formAthleteOptions.length === 0}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary disabled:opacity-60"
                >
                  <option value="">
                    {formAthleteOptions.length === 0 ? '没有匹配的运动员' : '请选择运动员'}
                  </option>
                  {formAthleteOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.sport ? `（${a.sport}）` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">训练日期</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">
                  RPE 自觉劳累程度（1-10）
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFormRpe(v)}
                      className={`h-8 w-8 rounded-ams text-xs font-medium transition-colors ${
                        formRpe === v
                          ? 'bg-ams-primary text-white'
                          : 'bg-ams-background border border-ams-border text-ams-text-secondary hover:border-ams-primary/60'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-ams-text-muted">
                  <span>轻松</span>
                  <span>力竭</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">训练时长（分钟）</label>
                <input
                  type="number"
                  min={1}
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="如 90"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">训练类型（可选）</label>
                <select
                  value={formTrainingType}
                  onChange={(e) => setFormTrainingType(e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                >
                  <option value="">请选择训练类型</option>
                  {['力量', '速度', '耐力', '柔韧', '技巧', '恢复'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">备注（可选）</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="如：力量训练 / 有氧恢复"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>

              {addMsg && (
                <div className="flex items-start gap-2 rounded-ams bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{addMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={isSaving}>
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 选择运动员弹窗 */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSelector(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-ams-lg bg-ams-surface border border-ams-border shadow-ams-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ams-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-ams-text-primary">选择运动员</h3>
                <p className="mt-0.5 text-xs text-ams-text-muted">
                  勾选需要展示负荷概览的运动员，当前已选 {selectedIds.length} 人
                </p>
              </div>
              <button
                onClick={() => setShowSelector(false)}
                className="text-ams-text-muted hover:text-ams-text-primary"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            {/* 队伍筛选 + 搜索 + 批量操作 */}
            <div className="border-b border-ams-border px-5 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                >
                  <option value="">全部队伍</option>
                  {sportOptions.map((s) => (
                    <option key={s.sport} value={s.sport}>
                      {s.sport}（{s.count}人）
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
                  <input
                    type="text"
                    value={selectorSearch}
                    onChange={(e) => setSelectorSearch(e.target.value)}
                    placeholder="搜索运动员姓名..."
                    className="w-full rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={selectAll}>
                  <Check className="h-3.5 w-3.5" />
                  全选
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  清空
                </Button>
                <span className="ml-auto text-xs text-ams-text-muted">
                  共 {filteredAthletes.length} 名运动员
                  {teamFilter && ` · 队伍「${teamFilter}」`}
                </span>
              </div>
            </div>

            {/* 运动员列表（按队伍/搜索筛选，有 ACWR 数据优先排序） */}
            <div className="ams-scrollbar flex-1 overflow-y-auto px-3 py-2">
              {filteredAthletes.length === 0 ? (
                <div className="py-10 text-center text-sm text-ams-text-muted">
                  没有匹配的运动员
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {filteredAthletes.map((a) => {
                    const isSelected = selectedIds.includes(a.id);
                    const hasLoad = overviewMap.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleSelect(a.id)}
                        className={`flex items-center gap-2 rounded-ams border px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-ams-primary bg-ams-primary/10 text-ams-text-primary'
                            : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface-hover'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected
                              ? 'border-ams-primary bg-ams-primary text-white'
                              : 'border-ams-border'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        {hasLoad && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ams-success" title="有负荷记录" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-ams-border px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setShowSelector(false)}>
                取消
              </Button>
              <Button size="sm" onClick={() => setShowSelector(false)}>
                完成
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
