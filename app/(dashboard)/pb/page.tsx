'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PersonalBest {
  id: number;
  athleteId: number;
  exerciseId: number;
  value: number;
  unit: string;
  achievedDate: string;
  athlete: { id: number; name: string };
  exercise: { id: number; name: string; category: string; unit: string };
}

interface Athlete {
  id: number;
  name: string;
}

interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  isPBTrackable: boolean;
}

export default function PBPage() {
  const [records, setRecords] = useState<PersonalBest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选
  const [athleteFilter, setAthleteFilter] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // 视图模式：list 列表 | group 按分类分组
  const [viewMode, setViewMode] = useState<'list' | 'group'>('list');

  // 选项数据
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // 新增 PB 弹窗
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAthleteId, setAddAthleteId] = useState('');
  const [addExerciseId, setAddExerciseId] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [isRecomputing, setIsRecomputing] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (athleteFilter) params.set('athleteId', athleteFilter);
      if (exerciseFilter) params.set('exerciseId', exerciseFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/pb?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || `请求失败（${res.status}）`);
      }
      setRecords(json.data.records);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 PB 记录失败');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, athleteFilter, exerciseFilter, categoryFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // 加载下拉选项
  useEffect(() => {
    fetch('/api/athletes?pageSize=100')
      .then(r => r.json())
      .then(j => { if (j.success) setAthletes(j.data.athletes); })
      .catch(() => {});
    fetch('/api/exercises?pageSize=100')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const exs = j.data.exercises;
          setExercises(exs);
          setCategories(Array.from(new Set(exs.map((e: Exercise) => e.category).filter(Boolean))));
        }
      })
      .catch(() => {});
  }, []);

  const resetFilters = () => {
    setAthleteFilter('');
    setExerciseFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  // 按分类分组（当前页数据内分组）
  const grouped = useMemo(() => {
    const map = new Map<string, PersonalBest[]>();
    for (const r of records) {
      const cat = r.exercise.category || '未分类';
      const arr = map.get(cat);
      if (arr) arr.push(r);
      else map.set(cat, [r]);
    }
    return Array.from(map.entries());
  }, [records]);

  // ---- 新增 PB ----
  const selectedExercise = exercises.find(e => e.id === parseInt(addExerciseId));

  const handleAdd = async () => {
    setAddMsg('');
    if (!addAthleteId) { setAddMsg('请选择运动员'); return; }
    if (!addExerciseId) { setAddMsg('请选择训练项目'); return; }
    if (!addValue || parseFloat(addValue) <= 0) { setAddMsg('请输入大于 0 的 PB 成绩'); return; }
    if (!addDate) { setAddMsg('请选择达成日期'); return; }

    setIsSaving(true);
    try {
      const res = await fetch('/api/pb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId: parseInt(addAthleteId),
          exerciseId: parseInt(addExerciseId),
          value: parseFloat(addValue),
          achievedDate: addDate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || '保存失败');
      }
      setShowAddModal(false);
      setAddAthleteId('');
      setAddExerciseId('');
      setAddValue('');
      fetchRecords();
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- 重算 ----
  const handleRecompute = async () => {
    if (!window.confirm('将基于历史训练记录重新计算所有 PB 数据（现有手动录入数据将被覆盖），确定继续？')) return;
    setIsRecomputing(true);
    try {
      const res = await fetch('/api/pb/recompute', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || '重算失败');
      }
      setPage(1);
      fetchRecords();
    } catch (e) {
      alert(e instanceof Error ? e.message : '重算失败');
    } finally {
      setIsRecomputing(false);
    }
  };

  const renderTable = (rows: PersonalBest[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ams-border">
            <th className="px-4 py-3 text-left ams-table-header">运动员</th>
            <th className="px-4 py-3 text-left ams-table-header">训练项目</th>
            <th className="px-4 py-3 text-left ams-table-header">分类</th>
            <th className="px-4 py-3 text-left ams-table-header">PB 成绩</th>
            <th className="px-4 py-3 text-left ams-table-header">达成日期</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
              <td className="px-4 py-3 text-ams-text-primary font-medium">{r.athlete.name}</td>
              <td className="px-4 py-3 text-ams-text-secondary">{r.exercise.name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-ams-surface-hover px-2 py-0.5 text-xs text-ams-text-secondary">
                  {r.exercise.category}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-lg font-bold text-ams-primary">
                  {r.value}
                  <span className="ml-1 text-sm font-normal text-ams-text-secondary">{r.unit}</span>
                </span>
              </td>
              <td className="px-4 py-3 text-ams-text-secondary">
                <Trophy className="mr-1 inline h-4 w-4 text-ams-warning" />
                {new Date(r.achievedDate).toLocaleDateString('zh-CN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-ams-warning" />
          <div>
            <h2 className="text-xl font-semibold text-ams-text-primary">PB 纪录</h2>
            <p className="text-xs text-ams-text-muted">运动员各训练项目的历史最佳成绩</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecompute}
            disabled={isRecomputing}
          >
            <RefreshCw className={`h-4 w-4 ${isRecomputing ? 'animate-spin' : ''}`} />
            {isRecomputing ? '重算中...' : '重新计算'}
          </Button>
          <Button size="sm" onClick={() => { setAddMsg(''); setShowAddModal(true); }}>
            <Plus className="h-4 w-4" />
            新增 PB 纪录
          </Button>
        </div>
      </div>

      {/* 筛选与视图切换 */}
      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ams-text-muted">
            <Search className="h-3.5 w-3.5" />
            筛选
          </div>
          <select
            value={athleteFilter}
            onChange={(e) => { setAthleteFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部运动员</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部分类</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={exerciseFilter}
            onChange={(e) => { setExerciseFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部项目</option>
            {exercises
              .filter(e => !categoryFilter || e.category === categoryFilter)
              .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={resetFilters}>重置</Button>

          <div className="ml-auto flex items-center gap-2">
            {/* 视图切换 */}
            <div className="flex rounded-ams border border-ams-border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === 'list' ? 'bg-ams-primary text-white' : 'bg-ams-surface text-ams-text-secondary hover:text-ams-text-primary'}`}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode('group')}
                className={`px-3 py-1.5 text-xs transition-colors ${viewMode === 'group' ? 'bg-ams-primary text-white' : 'bg-ams-surface text-ams-text-secondary hover:text-ams-text-primary'}`}
              >
                按分类分组
              </button>
            </div>
            <span className="text-sm text-ams-text-muted">共 {total} 条</span>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : error ? (
          <div className="p-8 text-center text-ams-danger">
            <p className="font-medium">加载失败</p>
            <p className="mt-1 text-sm text-ams-text-secondary">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchRecords()}>重试</Button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-ams-text-secondary opacity-40" />
            暂无 PB 纪录
            <p className="mt-1 text-xs">录入训练记录后系统自动生成，也可点击&ldquo;新增 PB 纪录&rdquo;手动录入</p>
          </div>
        ) : viewMode === 'group' ? (
          <div className="divide-y divide-ams-border/50">
            {grouped.map(([cat, rows]) => (
              <div key={cat}>
                <div className="flex items-center gap-2 bg-ams-surface/60 px-4 py-2.5">
                  <Trophy className="h-4 w-4 text-ams-warning" />
                  <span className="text-sm font-semibold text-ams-text-primary">{cat}</span>
                  <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                    {rows.length} 条
                  </span>
                </div>
                {renderTable(rows)}
              </div>
            ))}
          </div>
        ) : (
          renderTable(records)
        )}

        {!isLoading && !error && records.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ams-border px-4 py-3">
            <div className="text-sm text-ams-text-secondary">共 {total} 条</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="flex items-center px-2 text-sm text-ams-text-secondary">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          </div>
        )}
      </div>

      {/* 新增 PB 弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-ams border border-ams-border bg-ams-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ams-text-primary">新增 PB 纪录</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">运动员 *</label>
                <select
                  value={addAthleteId}
                  onChange={(e) => setAddAthleteId(e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                >
                  <option value="">请选择</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">训练项目 *</label>
                <select
                  value={addExerciseId}
                  onChange={(e) => setAddExerciseId(e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                >
                  <option value="">请选择</option>
                  {exercises.filter(e => e.isPBTrackable).map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}（{e.category} · {e.unit}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">
                  PB 成绩 *{selectedExercise ? `（单位：${selectedExercise.unit}）` : ''}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  placeholder={selectedExercise ? `请输入${selectedExercise.unit}数` : '请先选择训练项目'}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">达成日期 *</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>

              {addMsg && (
                <div className="rounded-ams bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
                  {addMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>取消</Button>
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
