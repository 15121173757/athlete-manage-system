'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Star, Edit2, Trash2, X, Filter, Heart, Dumbbell, Flame, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EquipmentPicker } from '@/lib/equipment-icons/EquipmentPicker';
import { useRouter } from 'next/navigation';

interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  difficulty: string | null;
  targetMuscles: string | null;
  equipment: string | null;
  demoImageUrl: string | null;
  demoVideoUrl: string | null;
  isFavorite: boolean;
  sortOrder: number;
  isPBTrackable: boolean;
  createdAt: string;
}

interface PaginationData {
  exercises: Exercise[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const categories = ['力量', '速度', '耐力', '柔韧', '技巧', '恢复'];
const difficulties = ['初级', '中级', '高级'];

const categoryIcons: Record<string, React.ReactNode> = {
  '力量': <Dumbbell className="h-4 w-4" />,
  '速度': <Flame className="h-4 w-4" />,
  '耐力': <Heart className="h-4 w-4" />,
  '柔韧': <Sparkles className="h-4 w-4" />,
  '技巧': <Star className="h-4 w-4" />,
  '恢复': <Heart className="h-4 w-4" />,
};

const difficultyColors: Record<string, string> = {
  '初级': 'text-ams-success bg-ams-success/10',
  '中级': 'text-ams-warning bg-ams-warning/10',
  '高级': 'text-ams-danger bg-ams-danger/10',
};

export default function ExercisesPage() {
  const [data, setData] = useState<PaginationData>({ exercises: [], total: 0, page: 1, pageSize: 50, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '50' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (favoriteOnly) params.set('isFavorite', 'true');

      const res = await fetch(`/api/exercises?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  }, [search, categoryFilter, difficultyFilter, favoriteOnly]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  const handleToggleFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/exercises/${id}/favorite`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) fetchExercises();
    } catch { /* empty */ }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除该练习？此操作不可撤销。')) return;
    try {
      const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) fetchExercises();
      else alert(json.error?.message || '删除失败');
    } catch { alert('网络错误'); }
  };

  const openCreate = () => { setEditingExercise(null); setShowForm(true); };
  const openEdit = (exercise: Exercise, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingExercise(exercise);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">练习库</h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建练习
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索练习名称或肌群..."
              className="w-64 rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部分类</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => { setDifficultyFilter(e.target.value); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部难度</option>
            {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button
            variant={favoriteOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={favoriteOnly ? '' : ''}
          >
            <Heart className={`h-4 w-4 ${favoriteOnly ? 'fill-current' : ''}`} />
            {favoriteOnly ? '全部' : '收藏'}
          </Button>
          {(search || categoryFilter || difficultyFilter || favoriteOnly) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setCategoryFilter(''); setDifficultyFilter(''); setFavoriteOnly(false); }}>
              <X className="h-4 w-4" />
              清除筛选
            </Button>
          )}
          <div className="ml-auto text-sm text-ams-text-muted">
            共 {data.total} 条
          </div>
        </div>
      </div>

      {/* 卡片网格 */}
      {isLoading ? (
        <div className="ams-card py-16 text-center text-ams-text-secondary">加载中...</div>
      ) : data.exercises.length === 0 ? (
        <div className="ams-card py-16 text-center text-ams-text-secondary">
          <Filter className="mx-auto h-10 w-10 text-ams-text-muted mb-2" />
          暂无练习数据，点击右上角新建
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onToggleFavorite={(e) => handleToggleFavorite(ex.id, e)}
              onEdit={(e) => openEdit(ex, e)}
              onDelete={(e) => handleDelete(ex.id, e)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ExerciseFormModal
          exercise={editingExercise}
          onClose={() => { setShowForm(false); setEditingExercise(null); }}
          onSaved={() => { setShowForm(false); setEditingExercise(null); fetchExercises(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// 练习卡片
// ============================================================

function ExerciseCard({
  exercise,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const router = useRouter();

  /** 点击卡片任意位置进入练习详情页（收藏/编辑/删除按钮除外） */
  const handleOpenDetail = () => {
    try {
      sessionStorage.setItem('ams-exercises-return', `${window.location.pathname}${window.location.search}`);
    } catch {
      /* 忽略存储异常 */
    }
    router.push(`/exercises/${exercise.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenDetail();
        }
      }}
      className="ams-card group relative cursor-pointer p-4 transition-all duration-200 hover:border-ams-primary hover:bg-ams-primary/[0.06] hover:shadow-ams-card hover:ring-2 hover:ring-ams-primary/40 focus:outline-none focus-visible:border-ams-primary focus-visible:ring-2 focus-visible:ring-ams-primary/40"
    >
      {/* 查看详情提示（桌面悬停显示） */}
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden items-center gap-1 rounded-full bg-ams-primary/15 px-2.5 py-1 text-xs font-medium text-ams-primary opacity-0 transition-opacity group-hover:opacity-100 md:flex">
        查看详情
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
            {categoryIcons[exercise.category] || <Dumbbell className="h-4 w-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ams-text-primary">{exercise.name}</h3>
            <p className="text-xs text-ams-text-muted">{exercise.category} · {exercise.unit}</p>
          </div>
        </div>
        <button
          onClick={onToggleFavorite}
          title={exercise.isFavorite ? '取消收藏' : '收藏'}
          className={`rounded-full p-1.5 transition-colors ${
            exercise.isFavorite ? 'text-ams-warning hover:bg-ams-warning/10' : 'text-ams-text-muted hover:text-ams-warning hover:bg-ams-surface-hover'
          }`}
        >
          <Heart className={`h-4 w-4 ${exercise.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {exercise.description && (
        <p className="mb-3 text-xs text-ams-text-secondary line-clamp-2">{exercise.description}</p>
      )}

      {exercise.equipment && (
        <div className="mb-3 flex items-start gap-1.5 text-xs text-ams-text-secondary">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ams-primary" />
          <span className="min-w-0 line-clamp-2" title={exercise.equipment}>
            {exercise.equipment}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {exercise.difficulty && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColors[exercise.difficulty] || 'text-ams-text-muted bg-ams-surface-hover'}`}>
            {exercise.difficulty}
          </span>
        )}
        {exercise.targetMuscles && (
          <span className="rounded-full px-2 py-0.5 text-xs text-ams-text-secondary bg-ams-surface-hover">
            {exercise.targetMuscles.length > 10 ? exercise.targetMuscles.slice(0, 10) + '...' : exercise.targetMuscles}
          </span>
        )}
        {exercise.isPBTrackable && (
          <span className="rounded-full px-2 py-0.5 text-xs text-ams-info bg-ams-info/10">PB追踪</span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" onClick={onEdit} title="编辑">
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} title="删除">
          <Trash2 className="h-4 w-4 text-ams-danger" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// 新建/编辑练习表单
// ============================================================

function ExerciseFormModal({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: exercise?.name || '',
    category: exercise?.category || '力量',
    unit: exercise?.unit || 'kg',
    description: exercise?.description || '',
    difficulty: exercise?.difficulty || '',
    targetMuscles: exercise?.targetMuscles || '',
    equipment: exercise?.equipment || '',
    demoImageUrl: exercise?.demoImageUrl || '',
    demoVideoUrl: exercise?.demoVideoUrl || '',
    isFavorite: exercise?.isFavorite || false,
    isPBTrackable: exercise?.isPBTrackable ?? true,
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('练习名称不能为空'); return; }
    if (!form.category.trim()) { setError('分类不能为空'); return; }
    if (!form.unit.trim()) { setError('计量单位不能为空'); return; }

    setIsSaving(true);
    setError('');
    try {
      const url = exercise ? `/api/exercises/${exercise.id}` : '/api/exercises';
      // 可选字段为空字符串时以 null 提交，与后端校验（仅接受 null/undefined）保持一致
      const payload = {
        ...form,
        difficulty: form.difficulty.trim() || null,
        demoImageUrl: form.demoImageUrl.trim() || null,
        demoVideoUrl: form.demoVideoUrl.trim() || null,
      };
      const res = await fetch(url, {
        method: exercise ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setError(json.error?.message || '保存失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto ams-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ams-text-primary">
            {exercise ? '编辑练习' : '新建练习'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-2 text-sm text-ams-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">练习名称 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：深蹲"
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">分类 *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">计量单位 *</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="如：kg / 次 / 秒"
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">难度</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
              >
                <option value="">未设置</option>
                {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ams-text-primary mb-1.5">动作描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="描述该练习的动作要领、注意事项等"
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ams-text-primary mb-1.5">目标肌群</label>
            <input
              type="text"
              value={form.targetMuscles}
              onChange={(e) => setForm({ ...form, targetMuscles: e.target.value })}
              placeholder="如：股四头肌、臀大肌"
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ams-text-primary mb-1.5">所用器材</label>
            {/* 简笔画快速选择（多选，点击图标选中/取消） */}
            <div className="mb-2">
              <EquipmentPicker
                value={form.equipment}
                onChange={(next) => setForm({ ...form, equipment: next })}
              />
            </div>
            <input
              type="text"
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              placeholder="点击上方器材简笔画快速选择，或手动输入（多个器材用逗号分隔）"
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">示范图片 URL</label>
              <input
                type="url"
                value={form.demoImageUrl}
                onChange={(e) => setForm({ ...form, demoImageUrl: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">示范视频 URL</label>
              <input
                type="url"
                value={form.demoVideoUrl}
                onChange={(e) => setForm({ ...form, demoVideoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-ams-text-primary">
              <input
                type="checkbox"
                checked={form.isFavorite}
                onChange={(e) => setForm({ ...form, isFavorite: e.target.checked })}
                className="h-4 w-4 rounded border-ams-border bg-ams-background text-ams-primary focus:ring-ams-primary"
              />
              设为收藏
            </label>
            <label className="flex items-center gap-2 text-sm text-ams-text-primary">
              <input
                type="checkbox"
                checked={form.isPBTrackable}
                onChange={(e) => setForm({ ...form, isPBTrackable: e.target.checked })}
                className="h-4 w-4 rounded border-ams-border bg-ams-background text-ams-primary focus:ring-ams-primary"
              />
              追踪个人纪录（PB）
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-ams-border">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '保存中...' : (exercise ? '保存修改' : '创建练习')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
