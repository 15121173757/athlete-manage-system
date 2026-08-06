'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, GripVertical, Search, X, ChevronDown, ChevronUp, Clock, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Athlete {
  id: number;
  name: string;
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

interface PlanItem {
  id: string;
  exerciseId: number;
  exercise: Exercise | null;
  dayOfWeek: number;
  sets: number;
  reps: number;
  load: number | null;
  restSeconds: number | null;
  duration: number | null;
  intensity: '低' | '中' | '高' | null;
  sortOrder: number;
  notes: string;
}

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function NewTrainingPlanPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [form, setForm] = useState({
    athleteIds: [] as number[],
    goal: '',
  });
  const [athleteSearch, setAthleteSearch] = useState('');
  const [showAthletePicker, setShowAthletePicker] = useState(false);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDayFilter, setPickerDayFilter] = useState<number>(1);

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

  const openPicker = (dayOfWeek: number) => {
    setPickerDayFilter(dayOfWeek);
    fetchExercisesForPicker();
    setShowPicker(true);
  };

  const addItemToPlan = (exercise: Exercise, dayOfWeek: number) => {
    const newItem: PlanItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      exerciseId: exercise.id,
      exercise,
      dayOfWeek,
      sets: 3,
      reps: 10,
      load: null,
      restSeconds: 60,
      duration: null,
      intensity: null,
      sortOrder: items.filter(i => i.dayOfWeek === dayOfWeek).length,
      notes: '',
    };
    setItems(prev => [...prev, newItem]);
    setShowPicker(false);
  };

  const updateItem = (id: string, updates: Partial<PlanItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const sameDayItems = prev
        .filter(i => i.dayOfWeek === item.dayOfWeek)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sameDayItems.findIndex(i => i.id === id);
      if (idx === -1) return prev;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sameDayItems.length) return prev;

      const swapItem = sameDayItems[swapIdx];
      return prev.map(i => {
        if (i.id === item.id) return { ...i, sortOrder: swapItem.sortOrder };
        if (i.id === swapItem.id) return { ...i, sortOrder: item.sortOrder };
        return i;
      });
    });
  };

  const groupedItems = weekDays.map((_, idx) => {
    const dayItems = items
      .filter(i => i.dayOfWeek === idx + 1)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { day: idx + 1, dayLabel: weekDays[idx], items: dayItems };
  });

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
  };

  const toggleAllAthletes = () => {
    if (form.athleteIds.length === athletes.length) {
      setForm((prev) => ({ ...prev, athleteIds: [] }));
    } else {
      setForm((prev) => ({ ...prev, athleteIds: athletes.map((a) => a.id) }));
    }
  };

  const filteredAthletes = athletes.filter(
    (a) => !athleteSearch || a.name.toLowerCase().includes(athleteSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 防御：练习/运动员选择弹窗仍打开时，视为选择流程未完成，阻止提交
    if (showPicker || showAthletePicker) { setError('请先完成练习项目选择后再提交'); return; }
    if (form.athleteIds.length === 0) { setError('请至少选择一名运动员'); return; }
    if (items.length === 0) { setError('请至少添加一个练习'); return; }

    setIsLoading(true);
    setError('');
    try {
      const payload = {
        athleteIds: form.athleteIds,
        goal: form.goal || null,
        items: items.map(i => ({
          dayOfWeek: i.dayOfWeek,
          exerciseId: i.exerciseId,
          sets: i.sets,
          reps: i.reps,
          load: i.load,
          restSeconds: i.restSeconds,
          duration: i.duration,
          intensity: i.intensity,
          sortOrder: i.sortOrder,
          notes: i.notes || null,
        })),
      };

      const res = await fetch('/api/training/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">本周目标</label>
              <textarea
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                rows={2}
                placeholder="例如：本周重点提升下肢力量，深蹲 1RM 目标突破 200kg"
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
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

          <div className="space-y-3">
            {groupedItems.map(({ day, dayLabel, items: dayItems }) => (
              <div key={day} className="rounded-ams border border-ams-border p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ams-text-primary">{dayLabel}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => openPicker(day)}>
                    <Plus className="h-3 w-3" />
                    添加练习
                  </Button>
                </div>

                {dayItems.length === 0 ? (
                  <p className="text-xs text-ams-text-muted py-2 text-center">暂无安排，点击上方按钮添加</p>
                ) : (
                  <div className="space-y-2">
                    {dayItems.map((item, idx) => (
                      <div key={item.id} className="rounded-ams bg-ams-surface p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveItem(item.id, 'up')}
                              disabled={idx === 0}
                              className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveItem(item.id, 'down')}
                              disabled={idx === dayItems.length - 1}
                              className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <GripVertical className="h-4 w-4 text-ams-text-muted" />
                          <span className="text-sm font-medium text-ams-text-primary flex-1">
                            {item.exercise?.name || `练习 #${item.exerciseId}`}
                          </span>
                          <span className="text-xs text-ams-text-muted">
                            {item.exercise?.category} · {item.exercise?.unit}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            className="text-ams-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pl-8">
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">组数</label>
                            <input
                              type="number" min={1}
                              value={item.sets}
                              onChange={(e) => updateItem(item.id, { sets: parseInt(e.target.value) || 1 })}
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">次数</label>
                            <input
                              type="number" min={1}
                              value={item.reps}
                              onChange={(e) => updateItem(item.id, { reps: parseInt(e.target.value) || 1 })}
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">负荷 ({item.exercise?.unit || 'kg'})</label>
                            <input
                              type="number" min={0} step={0.5}
                              value={item.load ?? ''}
                              onChange={(e) => updateItem(item.id, { load: e.target.value ? parseFloat(e.target.value) : null })}
                              placeholder="空"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">时长(分)</label>
                            <input
                              type="number" min={1}
                              value={item.duration ?? ''}
                              onChange={(e) => updateItem(item.id, { duration: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="可选"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">强度</label>
                            <select
                              value={item.intensity ?? ''}
                              onChange={(e) => updateItem(item.id, { intensity: (e.target.value || null) as PlanItem['intensity'] })}
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            >
                              <option value="">未选</option>
                              <option value="低">低</option>
                              <option value="中">中</option>
                              <option value="高">高</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">间歇(秒)</label>
                            <input
                              type="number" min={0}
                              value={item.restSeconds ?? ''}
                              onChange={(e) => updateItem(item.id, { restSeconds: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="60"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ams-text-muted mb-0.5">备注</label>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                              placeholder="可选"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
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
          onSelect={(ex) => addItemToPlan(ex, pickerDayFilter)}
          dayLabel={weekDays[pickerDayFilter - 1]}
        />
      )}

      {/* 运动员选择器弹窗 */}
      {showAthletePicker && (
        <AthletePickerModal
          athletes={filteredAthletes}
          selectedIds={form.athleteIds}
          onToggle={toggleAthlete}
          onToggleAll={toggleAllAthletes}
          onClose={() => { setShowAthletePicker(false); setAthleteSearch(''); }}
          searchValue={athleteSearch}
          onSearchChange={setAthleteSearch}
          totalCount={athletes.length}
        />
      )}
    </div>
  );
}

// ============================================================
// 练习选择器组件
// ============================================================

function ExercisePickerModal({
  exercises,
  onClose,
  onSelect,
  dayLabel,
}: {
  exercises: Exercise[];
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  dayLabel: string;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  const filtered = exercises.filter((ex) => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) && !ex.category.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && ex.category !== categoryFilter) return false;
    if (difficultyFilter && ex.difficulty !== difficultyFilter) return false;
    return true;
  });

  const categories = [...new Set(exercises.map(e => e.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden ams-card flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-ams-border">
          <div>
            <h3 className="text-lg font-semibold text-ams-text-primary">选择练习</h3>
            <p className="text-xs text-ams-text-muted">添加到 {dayLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 border-b border-ams-border">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索练习..."
                className="w-full rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">全部分类</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">全部难度</option>
              <option value="初级">初级</option>
              <option value="中级">中级</option>
              <option value="高级">高级</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-ams-text-muted">暂无匹配的练习</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onSelect(ex)}
                  className="flex items-center gap-3 rounded-ams bg-ams-surface p-3 text-left hover:bg-ams-surface-hover transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary text-sm">
                    {ex.category.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ams-text-primary truncate">{ex.name}</div>
                    <div className="text-xs text-ams-text-muted truncate">
                      {ex.category} · {ex.unit}
                      {ex.difficulty && ` · ${ex.difficulty}`}
                      {ex.isFavorite && ' · ★'}
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-transparent group-hover:text-ams-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-ams-border flex justify-between items-center">
          <span className="text-xs text-ams-text-muted">共 {filtered.length} 条</span>
          <Button variant="outline" onClick={onClose}>取消</Button>
        </div>
      </div>
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
  totalCount,
}: {
  athletes: Athlete[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onClose: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  totalCount: number;
}) {
  const allSelected = selectedIds.length === totalCount && totalCount > 0;

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

        <div className="p-4 border-b border-ams-border">
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
