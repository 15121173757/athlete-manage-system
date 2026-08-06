'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Filter,
  Dumbbell,
  Zap,
  Wind,
  Flame,
  Sparkles,
  Heart,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface FitnessTest {
  id: number;
  name: string;
  category: string;
  unit: string;
  direction: string;
  warningThreshold: number | null;
  description: string | null;
  purpose: string | null;
  applicableGroup: string | null;
  equipment: string | null;
  demoVideoUrl: string | null;
  diagramUrl: string | null;
  scoringStandard: string | null;
  referenceRange: string | null;
  precautions: string | null;
  createdAt: string;
}

const categories = ['力量测试', '爆发力测试', '速度敏捷测试', '供能系统测试', '柔韧测试', '其他'];

const directionOptions = [
  { value: 'HIGHER_BETTER', label: '越高越好' },
  { value: 'LOWER_BETTER', label: '越低越好' },
];

const categoryIcons: Record<string, React.ReactNode> = {
  '力量测试': <Dumbbell className="h-4 w-4" />,
  '爆发力测试': <Zap className="h-4 w-4" />,
  '速度敏捷测试': <Wind className="h-4 w-4" />,
  '供能系统测试': <Flame className="h-4 w-4" />,
  '柔韧测试': <Sparkles className="h-4 w-4" />,
  '其他': <Heart className="h-4 w-4" />,
};

const directionLabels: Record<string, string> = {
  HIGHER_BETTER: '越高越好',
  LOWER_BETTER: '越低越好',
};

export default function FitnessTestsView() {
  const [tests, setTests] = useState<FitnessTest[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTest, setEditingTest] = useState<FitnessTest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FitnessTest | null>(null);

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/fitness/tests');
      const json = await res.json();
      if (json.success) setTests(json.data);
    } catch {
      /* empty */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (directionFilter && t.direction !== directionFilter) return false;
      return true;
    });
  }, [tests, search, categoryFilter, directionFilter]);

  const openCreate = () => {
    setEditingTest(null);
    setShowForm(true);
  };

  const openEdit = (test: FitnessTest) => {
    setEditingTest(test);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/fitness/tests/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteTarget(null);
        fetchTests();
      } else {
        alert(json.error?.message || '删除失败');
      }
    } catch {
      alert('网络错误，删除失败');
    }
  };

  const hasFilter = search || categoryFilter || directionFilter;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建测试
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
              placeholder="搜索测试名称..."
              className="w-64 rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部方向</option>
            {directionOptions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setCategoryFilter(''); setDirectionFilter(''); }}
            >
              <X className="h-4 w-4" />
              清除筛选
            </Button>
          )}
          <div className="ml-auto text-sm text-ams-text-muted">
            共 {filteredTests.length} 条
          </div>
        </div>
      </div>

      {/* 卡片网格 */}
      {isLoading ? (
        <div className="ams-card py-16 text-center text-ams-text-secondary">加载中...</div>
      ) : filteredTests.length === 0 ? (
        <div className="ams-card py-16 text-center text-ams-text-secondary">
          <Filter className="mx-auto h-10 w-10 text-ams-text-muted mb-2" />
          {hasFilter ? '没有符合条件的测试项目' : '暂无测试项目，点击右上角新建'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => (
            <FitnessTestCard
              key={test.id}
              test={test}
              onEdit={() => openEdit(test)}
              onDelete={() => setDeleteTarget(test)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <FitnessTestFormModal
          test={editingTest}
          onClose={() => { setShowForm(false); setEditingTest(null); }}
          onSaved={() => { setShowForm(false); setEditingTest(null); fetchTests(); }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          test={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ============================================================
// 测试项目卡片
// ============================================================

function FitnessTestCard({
  test,
  onEdit,
  onDelete,
}: {
  test: FitnessTest;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();

  const equipmentList = test.equipment
    ? test.equipment.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const isHigher = test.direction === 'HIGHER_BETTER';

  /** 点击卡片任意位置进入测试详情页（编辑/删除按钮除外） */
  const handleOpenDetail = () => {
    try {
      sessionStorage.setItem('ams-fitness-tests-return', `${window.location.pathname}${window.location.search}`);
    } catch {
      /* 忽略存储异常 */
    }
    router.push(`/fitness/tests/${test.id}`);
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
      className="ams-card group relative cursor-pointer p-4 transition-all hover:border-ams-primary hover:bg-ams-primary/[0.06] hover:shadow-ams-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ams-primary"
    >
      {/* 查看详情提示（桌面悬停显示） */}
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-ams-primary/15 px-2.5 py-1 text-xs font-medium text-ams-primary opacity-0 transition-opacity group-hover:opacity-100 hidden md:flex items-center gap-1">
        查看详情
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
            {categoryIcons[test.category] || <Dumbbell className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ams-text-primary truncate">{test.name}</h3>
            <p className="text-xs text-ams-text-muted">{test.category} · {test.unit}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            title="编辑"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="删除"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4 text-ams-danger" />
          </Button>
        </div>
      </div>

      {test.description && (
        <p className="mb-3 text-xs text-ams-text-secondary line-clamp-2">{test.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="rounded-full px-2 py-0.5 text-xs text-ams-text-secondary bg-ams-surface-hover">
          {test.category}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isHigher
              ? 'text-ams-success bg-ams-success/10'
              : 'text-ams-warning bg-ams-warning/10'
          }`}
        >
          {directionLabels[test.direction] || test.direction}
        </span>
        {test.warningThreshold != null && (
          <span className="rounded-full px-2 py-0.5 text-xs text-ams-danger bg-ams-danger/10">
            预警 ≤ {test.warningThreshold}
          </span>
        )}
      </div>

      {equipmentList.length > 0 && (
        <div className="mb-2">
          <span className="ams-table-header">器材</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {equipmentList.slice(0, 4).map((eq, i) => (
              <span key={i} className="rounded bg-ams-background px-1.5 py-0.5 text-xs text-ams-text-secondary">
                {eq}
              </span>
            ))}
            {equipmentList.length > 4 && (
              <span className="text-xs text-ams-text-muted">+{equipmentList.length - 4}</span>
            )}
          </div>
        </div>
      )}

      {test.applicableGroup && (
        <div className="flex items-center gap-1 text-xs text-ams-text-muted">
          <Heart className="h-3 w-3" />
          <span className="truncate">{test.applicableGroup}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 新建/编辑测试表单
// ============================================================

interface FormState {
  name: string;
  category: string;
  unit: string;
  direction: string;
  warningThreshold: string;
  description: string;
  purpose: string;
  applicableGroup: string;
  equipment: string;
  demoVideoUrl: string;
  diagramUrl: string;
  scoringStandard: string;
  referenceRange: string;
  precautions: string;
}

function FitnessTestFormModal({
  test,
  onClose,
  onSaved,
}: {
  test: FitnessTest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: test?.name || '',
    category: test?.category || '力量测试',
    unit: test?.unit || '',
    direction: test?.direction || 'HIGHER_BETTER',
    warningThreshold: test?.warningThreshold != null ? String(test.warningThreshold) : '',
    description: test?.description || '',
    purpose: test?.purpose || '',
    applicableGroup: test?.applicableGroup || '',
    equipment: test?.equipment || '',
    demoVideoUrl: test?.demoVideoUrl || '',
    diagramUrl: test?.diagramUrl || '',
    scoringStandard: test?.scoringStandard || '',
    referenceRange: test?.referenceRange || '',
    precautions: test?.precautions || '',
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => {
    const trim = (s: string) => s.trim();
    const payload: Record<string, unknown> = {
      name: trim(form.name),
      category: trim(form.category),
      unit: trim(form.unit),
      direction: form.direction,
    };

    const wt = trim(form.warningThreshold);
    payload.warningThreshold = wt === '' ? null : Number(wt);

    const optionalStrings: (keyof FormState)[] = [
      'description', 'purpose', 'applicableGroup', 'equipment',
      'demoVideoUrl', 'diagramUrl', 'scoringStandard', 'referenceRange', 'precautions',
    ];
    for (const key of optionalStrings) {
      const v = trim(form[key]);
      payload[key] = v === '' ? null : v;
    }
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) { setError('测试名称不能为空'); return; }
    if (!form.category.trim()) { setError('分类不能为空'); return; }
    if (!form.unit.trim()) { setError('计量单位不能为空'); return; }

    if (form.warningThreshold.trim() !== '') {
      const wt = Number(form.warningThreshold.trim());
      if (Number.isNaN(wt)) { setError('预警阈值必须为数字'); return; }
    }

    if (form.demoVideoUrl.trim() !== '') {
      try { new URL(form.demoVideoUrl.trim()); }
      catch { setError('示范视频链接格式不正确'); return; }
    }
    if (form.diagramUrl.trim() !== '') {
      try { new URL(form.diagramUrl.trim()); }
      catch { setError('图解链接格式不正确'); return; }
    }

    setIsSaving(true);
    setError('');
    try {
      const url = test ? `/api/fitness/tests/${test.id}` : '/api/fitness/tests';
      const res = await fetch(url, {
        method: test ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setError(json.error?.message || '保存失败');
      }
    } catch {
      setError('网络错误，保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto ams-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ams-text-primary">
            {test ? '编辑测试' : '新建测试'}
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <FormSection title="基本信息">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="测试名称" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="如：深蹲 1RM"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
              <FormField label="分类" required>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="计量单位" required>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  placeholder="如：kg / 秒 / 次"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
              <FormField label="评价方向">
                <select
                  value={form.direction}
                  onChange={(e) => set('direction', e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                >
                  {directionOptions.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="预警阈值">
                <input
                  type="number"
                  step="any"
                  value={form.warningThreshold}
                  onChange={(e) => set('warningThreshold', e.target.value)}
                  placeholder="低于此值触发预警"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
            </div>
          </FormSection>

          {/* 描述信息 */}
          <FormSection title="描述信息">
            <div className="grid grid-cols-1 gap-4">
              <FormField label="测试描述">
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  placeholder="描述测试的动作要领、流程等"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="测试目的">
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => set('purpose', e.target.value)}
                    placeholder="如：评估下肢最大力量"
                    className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                  />
                </FormField>
                <FormField label="适用群体">
                  <input
                    type="text"
                    value={form.applicableGroup}
                    onChange={(e) => set('applicableGroup', e.target.value)}
                    placeholder="如：U16 以上队伍"
                    className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          {/* 资源信息 */}
          <FormSection title="资源信息">
            <div className="grid grid-cols-1 gap-4">
              <FormField label="所需器材">
                <input
                  type="text"
                  value={form.equipment}
                  onChange={(e) => set('equipment', e.target.value)}
                  placeholder="多个器材用逗号分隔，如：杠铃, 哑铃"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="示范视频 URL">
                  <input
                    type="url"
                    value={form.demoVideoUrl}
                    onChange={(e) => set('demoVideoUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                  />
                </FormField>
                <FormField label="动作图解 URL">
                  <input
                    type="url"
                    value={form.diagramUrl}
                    onChange={(e) => set('diagramUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          {/* 测试标准 */}
          <FormSection title="测试标准">
            <div className="grid grid-cols-1 gap-4">
              <FormField label="评分标准">
                <textarea
                  value={form.scoringStandard}
                  onChange={(e) => set('scoringStandard', e.target.value)}
                  rows={3}
                  placeholder="不同成绩对应的评分等级"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
              <FormField label="参考范围">
                <input
                  type="text"
                  value={form.referenceRange}
                  onChange={(e) => set('referenceRange', e.target.value)}
                  placeholder="如：优秀 ≥ 2.0x体重"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
              <FormField label="注意事项">
                <textarea
                  value={form.precautions}
                  onChange={(e) => set('precautions', e.target.value)}
                  rows={2}
                  placeholder="测试时需注意的安全事项"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </FormField>
            </div>
          </FormSection>

          <div className="flex justify-end gap-3 pt-4 border-t border-ams-border">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '保存中...' : (test ? '保存修改' : '创建测试')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// 表单辅助组件
// ============================================================

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="ams-table-header mb-3">{title}</h4>
      {children}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
        {label} {required && <span className="text-ams-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

// ============================================================
// 删除确认弹窗
// ============================================================

function DeleteConfirmModal({
  test,
  onCancel,
  onConfirm,
}: {
  test: FitnessTest;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md ams-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ams-danger/10 text-ams-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-ams-text-primary">确认删除</h3>
        </div>
        <p className="text-sm text-ams-text-secondary mb-6">
          确定要删除测试项目「<span className="text-ams-text-primary font-medium">{test.name}</span>」吗？
          该操作不可撤销，关联的测试记录可能受到影响。
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-4 w-4" />
            确认删除
          </Button>
        </div>
      </div>
    </div>
  );
}