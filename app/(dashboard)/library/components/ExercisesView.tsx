'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Filter, Heart, Dumbbell, Zap, Timer, Target, Gamepad2, Sun, Moon, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EquipmentPicker } from '@/lib/equipment-icons/EquipmentPicker';
import { useRouter } from 'next/navigation';
import { EXERCISE_CATEGORIES, TRACK_TYPES, getTrackType } from '@/lib/exercise/track-types';

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
  trackType: string;
  createdAt: string;
}

interface PaginationData {
  exercises: Exercise[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const categories = [...EXERCISE_CATEGORIES];
const difficulties = ['初级', '中级', '高级'];

const categoryIcons: Record<string, React.ReactNode> = {
  '力量': <Dumbbell className="h-4 w-4" />,
  '爆发力': <Zap className="h-4 w-4" />,
  '速度与敏捷': <Timer className="h-4 w-4" />,
  '耐力': <Heart className="h-4 w-4" />,
  '技术': <Target className="h-4 w-4" />,
  '游戏': <Gamepad2 className="h-4 w-4" />,
  '热身': <Sun className="h-4 w-4" />,
  '冷身': <Moon className="h-4 w-4" />,
};

const difficultyColors: Record<string, string> = {
  '初级': 'text-ams-success bg-ams-success/10',
  '中级': 'text-ams-warning bg-ams-warning/10',
  '高级': 'text-ams-danger bg-ams-danger/10',
};

export default function ExercisesView() {
  const [data, setData] = useState<PaginationData>({ exercises: [], total: 0, page: 1, pageSize: 50, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [error, setError] = useState('');

  /** 展示操作反馈提示（3 秒后自动消失） */
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '50' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (favoriteOnly) params.set('isFavorite', 'true');

      const res = await fetch(`/api/exercises?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error?.message || '加载练习数据失败');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
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

  /** 点击删除按钮：弹出应用内确认框（不依赖原生 confirm，避免嵌入/预览环境渲染问题） */
  const handleDelete = (exercise: Exercise, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(exercise);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
      // 兜底：响应非 JSON（如网关/代理错误）时不崩溃
      let json: { success?: boolean; error?: { message?: string } } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (json?.success) {
        showFeedback('success', '练习删除成功');
        fetchExercises();
      } else if (res.status === 401 || res.status === 403) {
        showFeedback('error', '没有删除该练习的权限，请联系管理员');
      } else {
        showFeedback('error', json?.error?.message || '删除失败，请重试');
      }
    } catch {
      showFeedback('error', '网络错误，删除失败');
    }
  };

  const openCreate = () => { setEditingExercise(null); setShowForm(true); };
  const openEdit = (exercise: Exercise, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingExercise(exercise);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-ams border px-4 py-2.5 text-sm ${
            feedback.type === 'success'
              ? 'border-ams-success/40 bg-ams-success/10 text-ams-success'
              : 'border-ams-danger/40 bg-ams-danger/10 text-ams-danger'
          }`}
          role="status"
        >
          <span>{feedback.type === 'success' ? '✓' : '✕'} {feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="opacity-60 transition-opacity hover:opacity-100"
            aria-label="关闭提示"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-end">
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
      ) : error ? (
        <div className="ams-card py-16 text-center text-ams-danger">{error}</div>
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
              onDelete={(e) => handleDelete(ex, e)}
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md ams-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="h-5 w-5 text-ams-danger" />
              <h3 className="text-lg font-semibold text-ams-text-primary">删除练习</h3>
            </div>
            <p className="text-sm text-ams-text-secondary mb-6">
              确定删除练习「{deleteTarget.name}」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="destructive" onClick={confirmDelete}>确定删除</Button>
            </div>
          </div>
        </div>
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
    router.push(`/library/exercises/${exercise.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenDetail}
      onKeyDown={(e) => {
        // 仅当焦点在卡片自身时响应键盘；内部按钮（编辑/删除/收藏）按 Enter/Space 不应触发跳转
        if (e.target !== e.currentTarget) return;
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
          <span className="rounded-full px-2 py-0.5 text-xs text-ams-info bg-ams-info/10">PB · {getTrackType(exercise.trackType).label}</span>
        )}
      </div>

      {/* 操作按钮：移动端（无 hover）常显；桌面悬停卡片时显示 */}
      <div className="flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
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
    trackType: exercise?.trackType || 'MAX_WEIGHT',
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

          <div className="rounded-ams border border-ams-border p-3">
            <label className="block text-sm font-medium text-ams-text-primary mb-2">追踪类型 *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRACK_TYPES.map((t) => {
                const active = form.trackType === t.code;
                return (
                  <label
                    key={t.code}
                    className={`flex cursor-pointer items-center gap-2 rounded-ams border px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-ams-primary bg-ams-primary/10 text-ams-primary'
                        : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="trackType"
                      className="h-4 w-4"
                      checked={active}
                      onChange={() => setForm({ ...form, trackType: t.code, unit: t.unit })}
                    />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ams-text-muted">
              选择后将自动配置 PB 追踪模板，并同步计量单位为「{getTrackType(form.trackType).unit}」
            </p>
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
