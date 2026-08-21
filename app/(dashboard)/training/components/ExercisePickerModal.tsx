'use client';

import { useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PickerExercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  difficulty: string | null;
  targetMuscles: string | null;
  isFavorite: boolean;
}

interface ExercisePickerModalProps {
  exercises: PickerExercise[];
  onClose: () => void;
  onSelect: (exercises: PickerExercise[]) => void;
}

/**
 * 练习选择器弹窗：多选练习后批量添加。
 * 新建训练计划与草稿计划编辑共用，保证交互一致。
 */
export default function ExercisePickerModal({
  exercises,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const filtered = exercises.filter((ex) => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) && !ex.category.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && ex.category !== categoryFilter) return false;
    if (difficultyFilter && ex.difficulty !== difficultyFilter) return false;
    return true;
  });

  const categories = [...new Set(exercises.map(e => e.category))];
  const selectedExercises = exercises.filter(ex => selectedIds.includes(ex.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // 全选/取消全选（仅作用于当前筛选结果）
  const allFilteredSelected = filtered.length > 0 && filtered.every(ex => selectedIds.includes(ex.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      const base = prev.filter(id => !filtered.some(ex => ex.id === id));
      return allFilteredSelected ? base : [...base, ...filtered.map(ex => ex.id)];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden ams-card flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-ams-border">
          <div>
            <h3 className="text-lg font-semibold text-ams-text-primary">选择练习</h3>
            <p className="text-xs text-ams-text-muted">可多选，勾选多个练习后点击底部按钮批量添加</p>
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
            <Button type="button" variant="outline" size="sm" onClick={toggleAll} disabled={filtered.length === 0}>
              {allFilteredSelected ? '取消全选' : '全选'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {exercises.length === 0 ? (
            <div className="py-16 text-center text-sm text-ams-text-muted">练习加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-ams-text-muted">暂无匹配的练习</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((ex) => {
                const selected = selectedIds.includes(ex.id);
                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleSelect(ex.id)}
                    className={`flex items-center gap-3 rounded-ams p-3 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-ams-primary/10 border border-ams-primary/30'
                        : 'bg-ams-surface border border-transparent hover:bg-ams-surface-hover'
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      selected ? 'border-ams-primary bg-ams-primary' : 'border-ams-border bg-ams-background'
                    }`}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 已选练习实时展示 */}
        {selectedExercises.length > 0 && (
          <div className="p-3 border-t border-ams-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-ams-text-muted">已选 {selectedExercises.length} 个练习：</span>
              <button
                type="button"
                onClick={clearSelection}
                className="ml-auto text-xs text-ams-text-muted hover:text-ams-danger hover:underline"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectedExercises.map(ex => (
                <span
                  key={ex.id}
                  className="inline-flex items-center gap-1 rounded-full bg-ams-primary/15 px-2.5 py-1 text-xs font-medium text-ams-primary"
                >
                  {ex.name}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(ex.id); }}
                    className="ml-0.5 rounded-full hover:bg-ams-primary/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-ams-border flex justify-between items-center">
          <span className="text-xs text-ams-text-muted">共 {filtered.length} 条 · 已选 {selectedExercises.length} 个</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={() => onSelect(selectedExercises)} disabled={selectedExercises.length === 0}>
              添加 {selectedExercises.length > 0 ? `${selectedExercises.length} 个` : ''}练习
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
