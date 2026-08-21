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
  Footprints,
  Scale,
  Ruler,
  Repeat,
  Crosshair,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EquipmentPicker } from '@/lib/equipment-icons/EquipmentPicker';
import { TestStandard, FITNESS_TEST_CATEGORIES } from '@/lib/fitness/test-types';
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
  standards: TestStandard[] | null;
  precautions: string | null;
  resultType: string;
  gradeOptions: string[] | null;
  createdAt: string;
}

// 标准 10 分类（与 lib/fitness/test-types.ts 保持一致，单源）
const categories = [...FITNESS_TEST_CATEGORIES];

const directionOptions = [
  { value: 'HIGHER_BETTER', label: '越高越好' },
  { value: 'LOWER_BETTER', label: '越低越好' },
];

const categoryIcons: Record<string, React.ReactNode> = {
  // 标准 10 分类
  '力量测试': <Dumbbell className="h-4 w-4" />,
  '爆发力测试': <Zap className="h-4 w-4" />,
  '速度测试': <Wind className="h-4 w-4" />,
  '敏捷测试': <Footprints className="h-4 w-4" />,
  '有氧耐力测试': <Heart className="h-4 w-4" />,
  '无氧耐力测试': <Flame className="h-4 w-4" />,
  '平衡稳定测试': <Scale className="h-4 w-4" />,
  '灵活性测试': <Sparkles className="h-4 w-4" />,
  '肌耐力测试': <Repeat className="h-4 w-4" />,
  '人体测量学': <Ruler className="h-4 w-4" />,
  '技术技能测试': <Crosshair className="h-4 w-4" />,
  // 兼容历史短分类（数据未归一化时兜底，避免图标退化）
  '力量': <Dumbbell className="h-4 w-4" />,
  '爆发力': <Zap className="h-4 w-4" />,
  '速度': <Wind className="h-4 w-4" />,
  '敏捷': <Footprints className="h-4 w-4" />,
  '耐力': <Heart className="h-4 w-4" />,
  '柔韧': <Sparkles className="h-4 w-4" />,
  '身体成分': <Ruler className="h-4 w-4" />,
};

const directionLabels: Record<string, string> = {
  HIGHER_BETTER: '越高越好',
  LOWER_BETTER: '越低越好',
};

export default function TestsView() {
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
      <div className="flex items-center justify-end">
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
    router.push(`/library/tests/${test.id}`);
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
  resultType: string;
  description: string;
  equipment: string;
  demoVideoUrl: string;
  diagramUrl: string;
  precautions: string;
}

const resultTypeOptions = [
  { value: 'NUMERIC', label: '数值型', hint: '时间、重量、次数等数值成绩' },
  { value: 'GRADE', label: '等级型', hint: '优秀、良好、及格等分级成绩' },
  { value: 'DESCRIPTIVE', label: '描述型', hint: '自由文本描述成绩' },
];

const resultTypeLabels: Record<string, string> = {
  NUMERIC: '数值型',
  GRADE: '等级型',
  DESCRIPTIVE: '描述型',
};

/** 测试标准（常模）组的表单草稿：输入框以字符串暂存，提交时校验并转数字 */
interface StandardDraft {
  normName: string;
  mean: string;
  stdDev: string;
}

/** 测试标准（常模）组的字段级校验错误 */
interface StandardFieldErrors {
  normName?: string;
  mean?: string;
  stdDev?: string;
}

const EMPTY_STANDARD_DRAFT: StandardDraft = { normName: '', mean: '', stdDev: '' };

/** 是否为有效数字 */
function isValidNumber(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

/** 标准组是否完全空白（三个字段均为空）：空白组不参与保存，也不触发必填校验 */
function isBlankStandard(item: StandardDraft): boolean {
  return item.normName.trim() === '' && item.mean.trim() === '' && item.stdDev.trim() === '';
}

/** 是否最多保留两位小数 */
function hasMaxTwoDecimals(value: string): boolean {
  const n = Number(value);
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-9;
}

/** 校验单个标准组草稿，返回字段级错误 */
function validateStandardDraft(item: StandardDraft): StandardFieldErrors {
  const errors: StandardFieldErrors = {};
  const normName = item.normName.trim();

  if (!normName) {
    errors.normName = '常模名称不能为空';
  } else if (normName.length > 50) {
    errors.normName = '常模名称不能超过50个字符';
  }

  if (item.mean.trim() === '') {
    errors.mean = '平均值不能为空';
  } else if (!isValidNumber(item.mean)) {
    errors.mean = '平均值必须为有效数字';
  } else if (!hasMaxTwoDecimals(item.mean)) {
    errors.mean = '平均值最多保留两位小数';
  }

  if (item.stdDev.trim() === '') {
    errors.stdDev = '标准差不能为空';
  } else if (!isValidNumber(item.stdDev)) {
    errors.stdDev = '标准差必须为有效数字';
  } else if (Number(item.stdDev) <= 0) {
    errors.stdDev = '标准差必须大于0';
  } else if (!hasMaxTwoDecimals(item.stdDev)) {
    errors.stdDev = '标准差最多保留两位小数';
  }

  return errors;
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
    resultType: test?.resultType || 'NUMERIC',
    description: test?.description || '',
    equipment: test?.equipment || '',
    demoVideoUrl: test?.demoVideoUrl || '',
    diagramUrl: test?.diagramUrl || '',
    precautions: test?.precautions || '',
  });
  // 等级型成绩选项：编辑时以已存选项初始化，默认两格
  const [gradeDrafts, setGradeDrafts] = useState<string[]>(() => {
    const existing = test?.gradeOptions;
    if (existing && existing.length > 0) return existing;
    return ['', ''];
  });
  // 测试标准（常模）组：默认加载两套；编辑时以已存数据初始化
  const [standardDrafts, setStandardDrafts] = useState<StandardDraft[]>(() => {
    const existing = test?.standards;
    if (existing && existing.length > 0) {
      return existing.map((s) => ({
        normName: s.normName,
        mean: String(s.mean),
        stdDev: String(s.stdDev),
      }));
    }
    return [EMPTY_STANDARD_DRAFT, EMPTY_STANDARD_DRAFT];
  });
  const [standardErrors, setStandardErrors] = useState<StandardFieldErrors[]>(() =>
    standardDrafts.map(() => ({}))
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 更新某个标准组的字段并即时校验该组 */
  const updateStandard = (index: number, field: keyof StandardDraft, value: string) => {
    const next = standardDrafts.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    setStandardDrafts(next);
    setStandardErrors((prev) => {
      const nextErrors = [...prev];
      nextErrors[index] = validateStandardDraft(next[index]);
      return nextErrors;
    });
  };

  /** 新增一套标准组（保持至少一套，不设上限以外的限制） */
  const addStandard = () => {
    setStandardDrafts((prev) => [...prev, EMPTY_STANDARD_DRAFT]);
    setStandardErrors((prev) => [...prev, {}]);
  };

  /** 删除一套标准组：至少保留一套，防止误删导致数据为空 */
  const removeStandard = (index: number) => {
    if (standardDrafts.length <= 1) return;
    setStandardDrafts((prev) => prev.filter((_, i) => i !== index));
    setStandardErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const trim = (s: string) => s.trim();
    const payload: Record<string, unknown> = {
      name: trim(form.name),
      category: trim(form.category),
      unit: trim(form.unit),
      direction: form.direction,
      resultType: form.resultType,
      // 等级型成绩选项：仅 GRADE 时提交清洗后的选项，其余类型置空
      gradeOptions:
        form.resultType === 'GRADE'
          ? gradeDrafts.map((g) => g.trim()).filter((g) => g !== '')
          : null,
      // 测试标准（常模）：过滤完全空白的组；全部为空时提交 null（无常模）
      standards: (() => {
        const filled = standardDrafts
          .filter((d) => !isBlankStandard(d))
          .map((d) => ({
            normName: d.normName.trim(),
            mean: Number(d.mean),
            stdDev: Number(d.stdDev),
          }));
        return filled.length > 0 ? filled : null;
      })(),
    };

    const optionalStrings: (keyof FormState)[] = [
      'description', 'equipment',
      'demoVideoUrl', 'diagramUrl', 'precautions',
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

    if (form.demoVideoUrl.trim() !== '') {
      try { new URL(form.demoVideoUrl.trim()); }
      catch { setError('示范视频链接格式不正确'); return; }
    }
    if (form.diagramUrl.trim() !== '') {
      try { new URL(form.diagramUrl.trim()); }
      catch { setError('图解链接格式不正确'); return; }
    }

    // 等级型成绩选项校验：至少 2 个非空、单个 ≤20 字、总数 ≤20
    if (form.resultType === 'GRADE') {
      const options = gradeDrafts.map((g) => g.trim()).filter((g) => g !== '');
      if (options.length < 2) { setError('等级型成绩至少需要2个成绩选项'); return; }
      if (options.length > 20) { setError('等级选项不能超过20个'); return; }
      if (options.some((o) => o.length > 20)) { setError('等级选项不能超过20个字符'); return; }
    }

    // 测试标准校验：仅校验已填写部分字段的标准组（完全空白的组将被过滤，不参与保存）
    const allErrors = standardDrafts.map(validateStandardDraft);
    const hasStandardErrors = allErrors.some(
      (e, i) => (e.normName || e.mean || e.stdDev) && !isBlankStandard(standardDrafts[i])
    );
    if (hasStandardErrors) {
      setStandardErrors(allErrors);
      setError('请完善测试标准：常模名称、平均值、标准差均为必填，标准差必须大于0');
      return;
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
        <div className="relative mb-6 flex items-center justify-center">
          <h3 className="text-lg font-semibold text-ams-text-primary">
            {test ? '编辑测试' : '新建测试'}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-0 top-1/2 -translate-y-1/2"
          >
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
              <FormField label="成绩类型">
                <select
                  value={form.resultType}
                  onChange={(e) => set('resultType', e.target.value)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                >
                  {resultTypeOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FormField>
            </div>
            {/* 成绩类型说明 */}
            <p className="mt-2 text-xs text-ams-text-secondary">
              {resultTypeOptions.find((t) => t.value === form.resultType)?.hint}
            </p>

            {/* 等级型：动态成绩选项编辑器 */}
            {form.resultType === 'GRADE' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                  成绩选项 <span className="text-ams-danger">*</span>
                  <span className="ml-2 text-xs font-normal text-ams-text-secondary">
                    至少 2 个、最多 20 个，每个不超过 20 字
                  </span>
                </label>
                <div className="space-y-2">
                  {gradeDrafts.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const next = [...gradeDrafts];
                          next[index] = e.target.value;
                          setGradeDrafts(next);
                        }}
                        placeholder={index === 0 ? '如：优秀' : index === 1 ? '如：良好' : '如：及格'}
                        maxLength={20}
                        className="flex-1 rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        title="删除该选项"
                        disabled={gradeDrafts.length <= 2}
                        onClick={() => {
                          if (gradeDrafts.length <= 2) return;
                          setGradeDrafts((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className={`shrink-0 ${
                          gradeDrafts.length <= 2
                            ? 'cursor-not-allowed text-ams-text-muted'
                            : 'text-ams-danger hover:bg-ams-danger/10'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setGradeDrafts((prev) => [...prev, ''])}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-ams border-2 border-dashed border-ams-primary/60 px-4 py-1.5 text-sm font-medium text-ams-primary transition-colors hover:border-ams-primary hover:bg-ams-primary/10"
                >
                  <Plus className="h-4 w-4" />
                  添加选项
                </button>
              </div>
            )}
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
            </div>
          </FormSection>

          {/* 资源信息 */}
          <FormSection title="资源信息">
            <div className="grid grid-cols-1 gap-4">
              <FormField label="所需器材">
                <div className="mb-2">
                  <EquipmentPicker
                    value={form.equipment}
                    onChange={(next) => set('equipment', next)}
                  />
                </div>
                <input
                  type="text"
                  value={form.equipment}
                  onChange={(e) => set('equipment', e.target.value)}
                  placeholder="点击上方器材简笔画快速选择，或手动输入（多个器材用逗号分隔）"
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
              <div>
                {/* 顶部唯一一组标题：水平居中对齐，与下方各列输入框对齐 */}
                <div className="flex items-center gap-3 pb-2">
                  <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="text-center text-sm font-medium text-ams-text-primary">
                      常模名称
                    </div>
                    <div className="text-center text-sm font-medium text-ams-text-primary">
                      平均值
                    </div>
                    <div className="text-center text-sm font-medium text-ams-text-primary">
                      标准差
                    </div>
                  </div>
                  {/* 与右侧删除图标占位对齐 */}
                  <div className="w-10 shrink-0" />
                </div>

                {/* 各套常模数据：简约风格，仅输入框，不再重复显示标题 */}
                <div className="divide-y divide-ams-border">
                  {standardDrafts.map((draft, index) => {
                    const errors = standardErrors[index] || {};
                    return (
                      <div key={index} className="flex items-start gap-3 py-3">
                        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="flex flex-col">
                            <input
                              type="text"
                              value={draft.normName}
                              onChange={(e) => updateStandard(index, 'normName', e.target.value)}
                              placeholder="如：优秀 / U16 男"
                              maxLength={50}
                              className={`w-full rounded-ams bg-ams-background border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:outline-none focus:ring-1 ${
                                errors.normName
                                  ? 'border-ams-danger focus:border-ams-danger focus:ring-ams-danger'
                                  : 'border-ams-border focus:border-ams-primary focus:ring-ams-primary'
                              }`}
                            />
                            <div className="mt-1 min-h-[1rem] text-xs text-ams-danger">
                              {errors.normName || ''}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={draft.mean}
                              onChange={(e) => updateStandard(index, 'mean', e.target.value)}
                              placeholder="如：75.5"
                              className={`w-full rounded-ams bg-ams-background border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:outline-none focus:ring-1 ${
                                errors.mean
                                  ? 'border-ams-danger focus:border-ams-danger focus:ring-ams-danger'
                                  : 'border-ams-border focus:border-ams-primary focus:ring-ams-primary'
                              }`}
                            />
                            <div className="mt-1 min-h-[1rem] text-xs text-ams-danger">
                              {errors.mean || ''}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              min="0.01"
                              value={draft.stdDev}
                              onChange={(e) => updateStandard(index, 'stdDev', e.target.value)}
                              placeholder="如：8.25"
                              className={`w-full rounded-ams bg-ams-background border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:outline-none focus:ring-1 ${
                                errors.stdDev
                                  ? 'border-ams-danger focus:border-ams-danger focus:ring-ams-danger'
                                  : 'border-ams-border focus:border-ams-primary focus:ring-ams-primary'
                              }`}
                            />
                            <div className="mt-1 min-h-[1rem] text-xs text-ams-danger">
                              {errors.stdDev || ''}
                            </div>
                          </div>
                        </div>
                        {/* 组右侧删除图标：至少保留一套 */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="删除该套标准"
                          disabled={standardDrafts.length <= 1}
                          onClick={() => removeStandard(index)}
                          className={`shrink-0 ${
                            standardDrafts.length <= 1
                              ? 'cursor-not-allowed text-ams-text-muted'
                              : 'text-ams-danger hover:bg-ams-danger/10'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 居中「+」按钮：动态添加一套新标准 */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={addStandard}
                  className="inline-flex items-center gap-1.5 rounded-ams border-2 border-dashed border-ams-primary/60 px-8 py-2.5 text-sm font-medium text-ams-primary transition-colors hover:border-ams-primary hover:bg-ams-primary/10"
                >
                  <Plus className="h-5 w-5" />
                  添加标准
                </button>
              </div>

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
