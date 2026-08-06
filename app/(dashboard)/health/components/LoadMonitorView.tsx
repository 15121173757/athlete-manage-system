'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Activity, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { riskStyles } from './riskStyles';
import { LoadBarChart } from './LoadBarChart';

/** 详情页「返回列表」来源记录键：进入运动员负荷详情前保存来源 URL（保留 tab 状态） */
const LOAD_RETURN_KEY = 'ams-load-return';

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

  // 录入弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [formAthlete, setFormAthlete] = useState('');
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

  // 加载运动员下拉选项
  useEffect(() => {
    fetch('/api/athletes?pageSize=100')
      .then((r) => r.json())
      .then((j) => { if (j.success) setAthletes(j.data.athletes || []); })
      .catch(() => {});
  }, []);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-medium text-ams-text-primary">运动员负荷概览（近 28 天）</h3>
          </div>
          <Button size="sm" onClick={() => { setAddMsg(''); setShowModal(true); }}>
            <Plus className="h-4 w-4" />
            录入负荷
          </Button>
        </div>

        {isLoading ? (
          <div className="ams-card p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : error ? (
          <div className="ams-card p-8 text-center text-ams-danger">{error}</div>
        ) : overview.length === 0 ? (
          <div className="ams-card p-10 text-center">
            <Activity className="mx-auto h-10 w-10 text-ams-text-muted" />
            <p className="mt-3 text-ams-text-secondary">暂无负荷记录</p>
            <p className="mt-1 text-sm text-ams-text-muted">
              训练量 = RPE × 训练时长（分钟），请点击右上角「录入负荷」添加运动员训练数据
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {overview.map((o) => {
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
                <label className="mb-1 block text-xs text-ams-text-muted">运动员</label>
                <select
                  value={formAthlete}
                  onChange={(e) => setFormAthlete(e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                >
                  <option value="">请选择运动员</option>
                  {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
    </div>
  );
}
