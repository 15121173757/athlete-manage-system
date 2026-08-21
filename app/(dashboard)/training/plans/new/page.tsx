'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, X, Clock, Check, Users, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExercisePickerModal from '@/app/(dashboard)/training/components/ExercisePickerModal';
import PlanItemEditor, { EditablePlanItem } from '@/app/(dashboard)/training/components/PlanItemEditor';

interface Athlete {
  id: number;
  name: string;
  sport: string;
}

interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  difficulty: string | null;
  targetMuscles: string | null;
  isFavorite: boolean;
}

export default function NewTrainingPlanPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [form, setForm] = useState({
    athleteIds: [] as number[],
    goal: '',
    startDate: '',
    startTime: '',
  });
  const [athleteSearch, setAthleteSearch] = useState('');
  const [athleteTeamFilter, setAthleteTeamFilter] = useState('');
  const [showAthletePicker, setShowAthletePicker] = useState(false);
  const [items, setItems] = useState<EditablePlanItem[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  /** 练习选择弹窗当前面向的运动员（多运动员独立配置） */
  const [pickerTargetAthleteId, setPickerTargetAthleteId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/athletes?pageSize=100').then(r => r.json()).then(j => {
      if (j.success) setAthletes(j.data.athletes);
    });
  }, []);

  const fetchExercisesForPicker = useCallback(async () => {
    try {
      const res = await fetch('/api/exercises?pageSize=200');
      const json = await res.json();
      if (json.success) setExercises(json.data.exercises);
    } catch { /* empty */ }
  }, []);

  const openPickerFor = (athleteId: number) => {
    setPickerTargetAthleteId(athleteId);
    fetchExercisesForPicker();
    setShowPicker(true);
  };

  const addItemsToPlan = (selectedExercises: Exercise[]) => {
    const targetAthleteId = pickerTargetAthleteId;
    if (targetAthleteId == null) return;
    // 组内排序号：在目标运动员已有练习的最大 sortOrder 基础上递增
    const groupItems = items.filter((i) => i.athleteId === targetAthleteId);
    const base = groupItems.length > 0 ? Math.max(...groupItems.map((i) => i.sortOrder)) + 1 : 0;
    const newItems: EditablePlanItem[] = selectedExercises.map((exercise, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      athleteId: targetAthleteId,
      exerciseId: exercise.id,
      exercise,
      sets: 3,
      reps: 10,
      load: null,
      restSeconds: 60,
      duration: null,
      tempo: '',
      sortOrder: base + i,
      notes: '',
    }));
    setItems(prev => [...prev, ...newItems]);
    setShowPicker(false);
  };

  const updateItem = (id: string, updates: Partial<EditablePlanItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx === -1) return prev;
      const item = prev[idx];
      // 仅在所属运动员分组内重排
      const groupIdxList = prev
        .map((i, index) => ({ i, index }))
        .filter(({ i }) => i.athleteId === item.athleteId);
      const pos = groupIdxList.findIndex(({ index }) => index === idx);
      if (pos === -1) return prev;
      const targetPos = direction === 'up' ? pos - 1 : pos + 1;
      if (targetPos < 0 || targetPos >= groupIdxList.length) return prev;
      const a = groupIdxList[pos];
      const b = groupIdxList[targetPos];
      const next = [...prev];
      [next[a.index], next[b.index]] = [next[b.index], next[a.index]];
      // 分组内 sortOrder 重新编号（从 0 起）
      const order = new Map<string, number>();
      let n = 0;
      for (const { i, index } of groupIdxList) {
        order.set(next[index].id, n);
        n += 1;
      }
      return next.map(i => (order.has(i.id) ? { ...i, sortOrder: order.get(i.id)! } : i));
    });
  };

  const toggleAthlete = (athleteId: number) => {
    setForm((prev) => ({
      ...prev,
      athleteIds: prev.athleteIds.includes(athleteId)
        ? prev.athleteIds.filter((id) => id !== athleteId)
        : [...prev.athleteIds, athleteId],
    }));
  };

  const removeAthlete = (athleteId: number) => {
    setForm((prev) => ({
      ...prev,
      athleteIds: prev.athleteIds.filter((id) => id !== athleteId),
    }));
    // 同步清理该运动员已配置的练习项，避免提交时出现无效关联
    setItems((prev) => prev.filter((i) => i.athleteId !== athleteId));
  };

  // 队伍（运动项目）维度选项：按项目分组统计人数，供选择弹窗筛选
  const athleteTeamOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of athletes) {
      const s = a.sport || '未登记';
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([sport, count]) => ({ sport, count }))
      .sort((x, y) => x.sport.localeCompare(y.sport, 'zh-CN'));
  }, [athletes]);

  // 运动员选择弹窗列表：队伍筛选 + 姓名搜索组合过滤，实时响应
  const filteredAthletes = athletes.filter(
    (a) =>
      (!athleteTeamFilter || (a.sport || '未登记') === athleteTeamFilter) &&
      (!athleteSearch || a.name.toLowerCase().includes(athleteSearch.toLowerCase()))
  );

  // 全选：选中当前筛选（队伍 + 搜索）下的全部运动员；无筛选时即全部运动员
  const toggleAllAthletes = () => {
    const filteredIds = filteredAthletes.map((a) => a.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => form.athleteIds.includes(id));
    if (allSelected) {
      setForm((prev) => ({ ...prev, athleteIds: prev.athleteIds.filter((id) => !filteredIds.includes(id)) }));
    } else {
      setForm((prev) => ({ ...prev, athleteIds: [...new Set([...prev.athleteIds, ...filteredIds])] }));
    }
  };

  const buildPayload = (draft: boolean) => ({
    athleteIds: form.athleteIds,
    goal: form.goal || null,
    // 草稿允许暂缺执行时间；正式创建在提交前已完成前端校验
    startDate: form.startDate || null,
    startTime: form.startTime || null,
    ...(draft ? { status: 'DRAFT' } : {}),
    items: items.map(i => ({
      athleteId: i.athleteId,
      exerciseId: i.exerciseId,
      sets: i.sets,
      reps: i.reps,
      load: i.load,
      restSeconds: i.restSeconds,
      duration: i.duration,
      tempo: i.tempo || null,
      sortOrder: i.sortOrder,
      notes: i.notes || null,
    })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showPicker || showAthletePicker) { setError('请先完成练习项目选择后再提交'); return; }
    if (form.athleteIds.length === 0) { setError('请至少选择一名运动员'); return; }
    if (!form.startDate) { setError('请选择执行开始日期'); return; }
    if (!form.startTime) { setError('请选择执行开始时间'); return; }
    if (items.length === 0) { setError('请至少添加一个练习项目'); return; }
    const uncovered = form.athleteIds.filter((aid) => !items.some((i) => i.athleteId === aid));
    if (uncovered.length > 0) { setError('每位运动员均需至少配置一个练习项目'); return; }

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/training/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(false)),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/training/plans/${json.data.id}`);
      } else {
        setError(json.error?.message || '创建失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (showPicker || showAthletePicker) { setError('请先完成当前弹窗操作'); return; }
    // 草稿允许暂缺执行时间/练习/运动员，但至少需有一定内容，避免产生空草稿
    const hasContent = form.goal.trim() || form.athleteIds.length > 0 || items.length > 0 || form.startDate;
    if (!hasContent) { setError('请至少填写训练目标、运动员或练习安排后再存为草稿'); return; }

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/training/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(true)),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/training/plans/${json.data.id}`);
      } else {
        setError(json.error?.message || '保存草稿失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/training/plans">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-ams-text-primary">新建训练计划</h2>
      </div>

      {error && (
        <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本信息 */}
        <div className="ams-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-ams-text-primary">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">运动员 *</label>
              <div className="rounded-ams bg-ams-background border border-ams-border p-3">
                {form.athleteIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {form.athleteIds.map((aid) => {
                      const athlete = athletes.find((a) => a.id === aid);
                      if (!athlete) return null;
                      return (
                        <span
                          key={aid}
                          className="inline-flex items-center gap-1 rounded-full bg-ams-primary/15 px-3 py-1 text-xs font-medium text-ams-primary"
                        >
                          {athlete.name}
                          <button
                            type="button"
                            onClick={() => removeAthlete(aid)}
                            className="ml-0.5 rounded-full hover:bg-ams-primary/20 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setShowAthletePicker(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-ams-border px-3 py-1 text-xs text-ams-text-muted hover:border-ams-primary hover:text-ams-primary"
                    >
                      <Plus className="h-3 w-3" />
                      添加
                    </button>
                  </div>
                )}
                {form.athleteIds.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAthletePicker(true)}
                    className="w-full py-3 text-sm text-ams-text-muted hover:text-ams-primary rounded-ams border border-dashed border-ams-border hover:border-ams-primary transition-colors"
                  >
                    <Users className="inline h-4 w-4 mr-1" />
                    点击选择运动员（支持多选）
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-ams-text-muted">
                已选择 {form.athleteIds.length} / {athletes.length} 名运动员
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">训练目标</label>
              <textarea
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                rows={2}
                placeholder="例如：重点提升下肢力量，深蹲 1RM 目标突破 200kg"
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
          </div>
        </div>

        {/* 执行时间 */}
        <div className="ams-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">训练计划执行时间</h3>
          </div>
          <p className="mb-4 text-xs text-ams-text-muted">设置训练计划的执行日期与开始时间</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ams-text-muted mb-1">开始日期 *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-ams-text-muted mb-1">开始时间 *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
              />
            </div>
          </div>
        </div>

        {/* 练习安排 */}
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">练习安排</h3>
            <span className="text-xs text-ams-text-muted">共 {items.length} 个练习</span>
          </div>
          <p className="mb-4 text-xs text-ams-text-muted">
            按运动员分组配置：每位运动员独立设置练习与参数，同一运动员的练习连续排列
          </p>

          {form.athleteIds.length === 0 ? (
            <div className="rounded-ams border border-dashed border-ams-border py-6 text-center text-sm text-ams-text-muted">
              请先在上方选择运动员，再为每位运动员配置练习项目
            </div>
          ) : (
            <div className="space-y-4">
              {form.athleteIds.map((aid) => {
                const athlete = athletes.find((a) => a.id === aid);
                if (!athlete) return null;
                const groupItems = items
                  .filter((i) => i.athleteId === aid)
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                return (
                  <div key={aid} className="rounded-ams border border-ams-border/70 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ams-text-primary">{athlete.name}</span>
                        <span className="text-xs text-ams-text-muted">{groupItems.length} 个练习</span>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => openPickerFor(aid)}>
                        <Plus className="h-3 w-3" />
                        添加练习
                      </Button>
                    </div>
                    {groupItems.length === 0 ? (
                      <div className="rounded-ams border border-dashed border-ams-border py-4 text-center text-xs text-ams-text-muted">
                        暂未为该运动员配置练习，点击右上角「添加练习」设置
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {groupItems.map((item, idx) => (
                          <PlanItemEditor
                            key={item.id}
                            item={item}
                            index={idx}
                            total={groupItems.length}
                            onChange={updateItem}
                            onMove={moveItem}
                            onRemove={removeItem}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isLoading}>
            <Save className="h-4 w-4" />
            {isLoading ? '保存中...' : '存为草稿'}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? '创建中...' : '创建计划'}
          </Button>
        </div>
      </form>

      {/* 练习选择器弹窗 */}
      {showPicker && (
        <ExercisePickerModal
          exercises={exercises}
          onClose={() => setShowPicker(false)}
          onSelect={addItemsToPlan}
        />
      )}

      {/* 运动员选择器弹窗 */}
      {showAthletePicker && (
        <AthletePickerModal
          athletes={filteredAthletes}
          selectedIds={form.athleteIds}
          onToggle={toggleAthlete}
          onToggleAll={toggleAllAthletes}
          onClose={() => { setShowAthletePicker(false); setAthleteSearch(''); setAthleteTeamFilter(''); }}
          searchValue={athleteSearch}
          onSearchChange={setAthleteSearch}
          teamFilter={athleteTeamFilter}
          onTeamFilterChange={setAthleteTeamFilter}
          teamOptions={athleteTeamOptions}
          totalCount={filteredAthletes.length}
        />
      )}
    </div>
  );
}

// ============================================================
// 运动员选择器组件
// ============================================================

function AthletePickerModal({
  athletes,
  selectedIds,
  onToggle,
  onToggleAll,
  onClose,
  searchValue,
  onSearchChange,
  teamFilter,
  onTeamFilterChange,
  teamOptions,
  totalCount,
}: {
  athletes: Athlete[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onClose: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  teamFilter: string;
  onTeamFilterChange: (v: string) => void;
  teamOptions: { sport: string; count: number }[];
  totalCount: number;
}) {
  // 当前筛选（队伍 + 搜索）下的列表是否全部已选
  const allSelected = totalCount > 0 && athletes.every((a) => selectedIds.includes(a.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] overflow-hidden ams-card flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-ams-border">
          <div>
            <h3 className="text-lg font-semibold text-ams-text-primary">选择运动员</h3>
            <p className="text-xs text-ams-text-muted">可多选，已选 {selectedIds.length} 人</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 border-b border-ams-border space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="搜索运动员姓名..."
                className="w-full rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
            <Button variant="outline" size="sm" onClick={onToggleAll}>
              {allSelected ? '取消全选' : '全选'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs text-ams-text-muted">队伍</label>
            <select
              value={teamFilter}
              onChange={(e) => onTeamFilterChange(e.target.value)}
              className="flex-1 rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
            >
              <option value="">全部队伍</option>
              {teamOptions.map((t) => (
                <option key={t.sport} value={t.sport}>
                  {t.sport}（{t.count}人）
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {athletes.length === 0 ? (
            <div className="py-16 text-center text-ams-text-muted">暂无匹配的运动员</div>
          ) : (
            <div className="space-y-1">
              {athletes.map((a) => {
                const checked = selectedIds.includes(a.id);
                return (
                  <div
                    key={a.id}
                    onClick={() => onToggle(a.id)}
                    className={`flex items-center gap-3 rounded-ams p-3 cursor-pointer transition-colors ${
                      checked ? 'bg-ams-primary/10 border border-ams-primary/30' : 'hover:bg-ams-surface border border-transparent'
                    }`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                      checked ? 'border-ams-primary bg-ams-primary' : 'border-ams-border'
                    }`}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm ${checked ? 'text-ams-text-primary font-medium' : 'text-ams-text-secondary'}`}>
                      {a.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-ams-border flex justify-between items-center">
          <span className="text-xs text-ams-text-muted">共 {athletes.length} 条</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={onClose}>确认选择</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
