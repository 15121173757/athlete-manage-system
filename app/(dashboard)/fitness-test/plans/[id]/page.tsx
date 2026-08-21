'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  CloudSun,
  Building2,
  StickyNote,
  Users,
  Package,
  Trash2,
  Check,
  X,
  Dumbbell,
  Send,
  Edit2,
  Search,
  Save,
  ClipboardCheck,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanItem {
  id: number;
  testId: number;
  sortOrder: number;
  allocatedMinutes: number | null;
  equipmentReady: boolean;
  test: { id: number; name: string; category: string; unit: string; equipment: string | null };
}

interface PlanParticipant {
  id: number;
  athleteId: number;
  athlete: { id: number; name: string };
}

interface FitnessPlan {
  id: number;
  name: string;
  testDate: string;
  startTime: string | null;
  estimatedDuration: number | null;
  location: string | null;
  weather: string | null;
  venueCondition: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  items: PlanItem[];
  participants: PlanParticipant[];
  createdBy: { id: number; name: string };
}

interface EquipmentSummaryItem {
  name: string;
  count: number;
  ready: boolean;
}

interface FitnessTest {
  id: number;
  name: string;
  category: string;
  unit: string;
  equipment: string | null;
}

interface Athlete {
  id: number;
  name: string;
}

interface EditItem {
  testId: number;
  test: FitnessTest;
  sortOrder: number;
  allocatedMinutes: number | null;
}

const inputClass =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-ams-text-secondary/10 text-ams-text-secondary' },
  SCHEDULED: { label: '待执行', color: 'bg-ams-primary/10 text-ams-primary' },
  COMPLETED: { label: '已执行', color: 'bg-ams-success/10 text-ams-success' },
};

const categoryIcons: Record<string, React.ReactNode> = {
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
  力量: <Dumbbell className="h-4 w-4" />,
  爆发力: <Dumbbell className="h-4 w-4" />,
  速度: <Clock className="h-4 w-4" />,
  耐力: <Clock className="h-4 w-4" />,
};

export default function FitnessTestPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<FitnessPlan | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [itemReadyState, setItemReadyState] = useState<Record<number, boolean>>({});

  // 发布状态
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  // 草稿编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [editError, setEditError] = useState('');
  const [tests, setTests] = useState<FitnessTest[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [testCategoryFilter, setTestCategoryFilter] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    testDate: '',
    startTime: '',
    estimatedDuration: '',
    location: '',
    weather: '',
    venueCondition: '',
    notes: '',
  });
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editParticipantIds, setEditParticipantIds] = useState<number[]>([]);

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    fetch(`/api/fitness/plans/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setPlan(json.data);
          const readyMap: Record<number, boolean> = {};
          for (const item of json.data.items || []) {
            readyMap[item.id] = !!item.equipmentReady;
          }
          setItemReadyState(readyMap);
        } else {
          setError(json.error?.message || '加载失败');
        }
      })
      .catch(() => setError('网络错误，请稍后重试'))
      .finally(() => setIsLoading(false));

    fetch(`/api/fitness/plans/${id}/equipment`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setEquipment(json.data);
      })
      .catch(() => {
        /* 器材汇总加载失败不阻塞主流程 */
      });
  }, [params.id]);

  const toggleEquipmentReady = (itemId: number) => {
    setItemReadyState((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (
      !confirm(
        `确定删除测试计划「${plan.name}」？此操作不可撤销。`
      )
    )
      return;
    try {
      const res = await fetch(`/api/fitness/plans/${plan.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        router.push('/fitness-test/plans');
      } else {
        alert(json.error?.message || '删除失败');
      }
    } catch {
      alert('网络错误，请稍后重试');
    }
  };

  /** 发布草稿：校验完整性后由后端按执行时间自动判定为待执行或已执行 */
  const handlePublish = async () => {
    if (!plan) return;
    setIsPublishing(true);
    setPublishMsg('');
    try {
      const res = await fetch(`/api/fitness/plans/${plan.id}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        const label = statusLabels[json.data.status]?.label || json.data.status;
        setPublishMsg(`发布成功，状态已更新为「${label}」`);
      } else {
        setPublishMsg(json.error?.message || '发布失败');
      }
    } catch {
      setPublishMsg('网络错误，请稍后重试');
    } finally {
      setIsPublishing(false);
    }
  };

  /** 进入草稿编辑模式：用当前计划数据初始化表单 */
  const startEdit = () => {
    if (!plan) return;
    if (tests.length === 0) {
      fetch('/api/fitness/tests')
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setTests(j.data);
        });
    }
    if (athletes.length === 0) {
      fetch('/api/athletes?pageSize=200')
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setAthletes(j.data.athletes);
        });
    }
    setEditForm({
      name: plan.name,
      testDate: plan.testDate.slice(0, 10),
      startTime: plan.startTime || '',
      estimatedDuration: plan.estimatedDuration?.toString() || '',
      location: plan.location || '',
      weather: plan.weather || '',
      venueCondition: plan.venueCondition || '',
      notes: plan.notes || '',
    });
    setEditItems(
      plan.items.map((i) => ({
        testId: i.testId,
        test: { id: i.test.id, name: i.test.name, category: i.test.category, unit: i.test.unit, equipment: i.test.equipment },
        sortOrder: i.sortOrder,
        allocatedMinutes: i.allocatedMinutes,
      }))
    );
    setEditParticipantIds(plan.participants.map((p) => p.athleteId));
    setEditError('');
    setSaveMsg('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  /** 保存草稿修改：草稿未显式转正，后端保持草稿状态 */
  const handleSaveEdit = async () => {
    if (!plan) return;
    if (!editForm.name.trim()) {
      setEditError('请输入计划名称');
      return;
    }
    if (!editForm.testDate) {
      setEditError('请选择测试日期');
      return;
    }
    setIsSaving(true);
    setEditError('');
    try {
      const sorted = [...editItems].sort((a, b) => a.sortOrder - b.sortOrder);
      const res = await fetch(`/api/fitness/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          testDate: editForm.testDate,
          startTime: editForm.startTime || null,
          estimatedDuration: editForm.estimatedDuration
            ? parseInt(editForm.estimatedDuration)
            : null,
          location: editForm.location || null,
          weather: editForm.weather || null,
          venueCondition: editForm.venueCondition || null,
          notes: editForm.notes || null,
          items: sorted.map((i, idx) => ({
            testId: i.testId,
            sortOrder: idx,
            allocatedMinutes: i.allocatedMinutes,
          })),
          participantIds: editParticipantIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        const readyMap: Record<number, boolean> = {};
        for (const item of json.data.items || []) {
          readyMap[item.id] = !!item.equipmentReady;
        }
        setItemReadyState(readyMap);
        setIsEditing(false);
        setSaveMsg('保存成功，草稿内容已更新');
        // 测试项目可能变化，重新拉取器材汇总
        fetch(`/api/fitness/plans/${plan.id}/equipment`)
          .then((r) => r.json())
          .then((j) => {
            if (j.success) setEquipment(j.data);
          });
      } else {
        setEditError(json.error?.message || '保存失败');
      }
    } catch {
      setEditError('网络错误，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditTest = (test: FitnessTest) => {
    setEditItems((prev) => {
      const exists = prev.find((i) => i.testId === test.id);
      if (exists) {
        return prev.filter((i) => i.testId !== test.id);
      }
      return [
        ...prev,
        { testId: test.id, test, sortOrder: prev.length, allocatedMinutes: null },
      ];
    });
  };

  const updateEditItem = (testId: number, updates: Partial<EditItem>) => {
    setEditItems((prev) =>
      prev.map((i) => (i.testId === testId ? { ...i, ...updates } : i))
    );
  };

  const moveEditItem = (testId: number, direction: 'up' | 'down') => {
    setEditItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((i) => i.testId === testId);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const aOrder = a.sortOrder;
      a.sortOrder = b.sortOrder;
      b.sortOrder = aOrder;
      return [...sorted];
    });
  };

  const toggleEditParticipant = (athleteId: number) => {
    setEditParticipantIds((prev) =>
      prev.includes(athleteId)
        ? prev.filter((id) => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const toggleSelectAllEditAthletes = () => {
    const filtered = athletes.filter((a) => {
      if (!athleteSearch) return true;
      return a.name.toLowerCase().includes(athleteSearch.toLowerCase());
    });
    if (filtered.every((a) => editParticipantIds.includes(a.id))) {
      setEditParticipantIds((prev) =>
        prev.filter((id) => !filtered.find((a) => a.id === id))
      );
    } else {
      setEditParticipantIds((prev) => [
        ...new Set([...prev, ...filtered.map((a) => a.id)]),
      ]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ams-text-secondary">
        加载中...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/fitness-test/plans" replace>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
        </div>
        <div className="ams-card py-16 text-center text-ams-text-secondary">
          {error || '测试计划不存在'}
        </div>
      </div>
    );
  }

  const statusInfo = statusLabels[plan.status] || {
    label: plan.status,
    color: 'bg-ams-surface text-ams-text-secondary',
  };

  const sortedItems = [...plan.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const readyCount = sortedItems.filter((i) => itemReadyState[i.id]).length;

  const editCategories = [...new Set(tests.map((t) => t.category))];
  const editFilteredTests = tests.filter((t) => {
    if (testSearch && !t.name.toLowerCase().includes(testSearch.toLowerCase()))
      return false;
    if (testCategoryFilter && t.category !== testCategoryFilter) return false;
    return true;
  });
  const editFilteredAthletes = athletes.filter((a) => {
    if (!athleteSearch) return true;
    return a.name.toLowerCase().includes(athleteSearch.toLowerCase());
  });
  const allEditSelected =
    editFilteredAthletes.length > 0 &&
    editFilteredAthletes.every((a) => editParticipantIds.includes(a.id));

  return (
    <div className="space-y-6">
      {/* 头部操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/fitness-test/plans" replace>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
          <h2 className="text-xl font-semibold text-ams-text-primary">
            测试计划详情
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan.status === 'COMPLETED' && (
            <Link href={`/fitness-test/results?planId=${plan.id}`}>
              <Button size="sm" className="bg-ams-success hover:bg-ams-success/90">
                <ClipboardCheck className="h-4 w-4" />
                录入成绩
              </Button>
            </Link>
          )}
          {plan.status === 'DRAFT' && (
            <>
              <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                <Send className="h-4 w-4" />
                {isPublishing ? '发布中...' : '发布'}
              </Button>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Edit2 className="h-4 w-4" />
                编辑
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-ams-danger border-ams-danger/30 hover:bg-ams-danger/10"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {/* 计划信息卡片（编辑模式 / 查看模式） */}
      {isEditing ? (
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">编辑草稿</h3>
            {editError && (
              <span className="text-xs text-ams-danger">{editError}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                计划名称 *
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="例如：2026年8月夏训期体能测试"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                测试日期 *
              </label>
              <input
                type="date"
                value={editForm.testDate}
                onChange={(e) => setEditForm({ ...editForm, testDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                开始时间
              </label>
              <input
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                预计时长（分钟）
              </label>
              <input
                type="number"
                min={1}
                value={editForm.estimatedDuration}
                onChange={(e) =>
                  setEditForm({ ...editForm, estimatedDuration: e.target.value })
                }
                placeholder="例如：120"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                测试地点
              </label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="例如：训练基地田径场"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                天气状况
              </label>
              <input
                type="text"
                value={editForm.weather}
                onChange={(e) => setEditForm({ ...editForm, weather: e.target.value })}
                placeholder="例如：晴 25℃"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                场地条件
              </label>
              <input
                type="text"
                value={editForm.venueCondition}
                onChange={(e) =>
                  setEditForm({ ...editForm, venueCondition: e.target.value })
                }
                placeholder="例如：塑胶跑道干燥，力量房通风良好"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                备注
              </label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                placeholder="其他需要说明的事项"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSaving}>
              取消
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? '保存中...' : '保存修改'}
            </Button>
          </div>
        </div>
      ) : (
      <div className="ams-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
              {plan.status === 'DRAFT' && !publishMsg && (
                <span className="text-xs text-ams-text-muted">
                  草稿尚未发布，发布后按执行时间自动判定为待执行或已执行
                </span>
              )}
              {publishMsg && (
                <span
                  className={`text-xs ${
                    publishMsg.includes('成功')
                      ? 'text-ams-success'
                      : 'text-ams-danger'
                  }`}
                >
                  {publishMsg}
                </span>
              )}
              {saveMsg && (
                <span className="text-xs text-ams-success">{saveMsg}</span>
              )}
              <h3 className="text-lg font-semibold text-ams-text-primary">
                {plan.name}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-ams-text-secondary">
                <CalendarDays className="h-4 w-4 text-ams-text-muted shrink-0" />
                <span>
                  {new Date(plan.testDate).toLocaleDateString('zh-CN')}
                  {plan.startTime && ` ${plan.startTime}`}
                </span>
              </div>
              {plan.estimatedDuration !== null && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <Clock className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>预计 {plan.estimatedDuration} 分钟</span>
                </div>
              )}
              {plan.location && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <MapPin className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>{plan.location}</span>
                </div>
              )}
              {plan.weather && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <CloudSun className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>{plan.weather}</span>
                </div>
              )}
              {plan.venueCondition && (
                <div className="flex items-center gap-2 text-ams-text-secondary">
                  <Building2 className="h-4 w-4 text-ams-text-muted shrink-0" />
                  <span>{plan.venueCondition}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-ams-text-secondary">
                <Users className="h-4 w-4 text-ams-text-muted shrink-0" />
                <span>创建人：{plan.createdBy?.name || '-'}</span>
              </div>
            </div>
            {plan.notes && (
              <div className="flex items-start gap-2 mt-2 pt-3 border-t border-ams-border">
                <StickyNote className="h-4 w-4 text-ams-primary mt-0.5 shrink-0" />
                <p className="text-sm text-ams-text-secondary">{plan.notes}</p>
              </div>
            )}
          </div>
          <div className="text-right text-sm text-ams-text-muted shrink-0">
            <div>共 {plan.items.length} 个测试项目</div>
            <div>{plan.participants.length} 名参与人员</div>
            {plan.createdAt && (
              <div className="text-xs mt-1">
                创建于 {new Date(plan.createdAt).toLocaleDateString('zh-CN')}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 测试项目列表（编辑模式 / 查看模式） */}
      {isEditing ? (
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">
              编辑测试项目
            </h3>
            <span className="text-xs text-ams-text-muted">
              已选 {editItems.length} 项
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
              <input
                type="text"
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="搜索测试项目..."
                className={inputClass.replace('px-3', 'pl-10 pr-4')}
              />
            </div>
            <select
              value={testCategoryFilter}
              onChange={(e) => setTestCategoryFilter(e.target.value)}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">全部分类</option>
              {editCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {editFilteredTests.length === 0 ? (
            <div className="py-6 text-center text-ams-text-muted text-sm">
              暂无匹配的测试项目
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {editFilteredTests.map((t) => {
                const checked = editItems.some((i) => i.testId === t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleEditTest(t)}
                    className={`flex items-center gap-3 rounded-ams border p-3 cursor-pointer transition-colors ${
                      checked
                        ? 'border-ams-primary bg-ams-primary/10'
                        : 'border-ams-border bg-ams-surface hover:bg-ams-surface-hover'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        checked
                          ? 'border-ams-primary bg-ams-primary text-white'
                          : 'border-ams-border'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ams-text-primary truncate">
                        {t.name}
                      </div>
                      <div className="text-xs text-ams-text-muted truncate">
                        {t.category} · {t.unit}
                        {t.equipment && ` · 器材：${t.equipment}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {editItems.length > 0 && (
            <div className="rounded-ams border border-ams-border">
              <div className="border-b border-ams-border px-3 py-2 text-xs font-medium text-ams-text-secondary">
                已选项目（按顺序执行）
              </div>
              <div className="divide-y divide-ams-border/50">
                {[...editItems]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item, idx, arr) => (
                    <div key={item.testId} className="flex items-center gap-3 p-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ams-text-primary truncate">
                          {item.test.name}
                        </div>
                        <div className="text-xs text-ams-text-muted">
                          {item.test.category}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveEditItem(item.testId, 'up')}
                          disabled={idx === 0}
                          className="rounded px-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30 text-xs"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveEditItem(item.testId, 'down')}
                          disabled={idx === arr.length - 1}
                          className="rounded px-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30 text-xs"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-ams-text-muted" />
                        <input
                          type="number"
                          min={1}
                          value={item.allocatedMinutes ?? ''}
                          onChange={(e) =>
                            updateEditItem(item.testId, {
                              allocatedMinutes: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            })
                          }
                          placeholder="分钟"
                          className="w-20 rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-xs text-ams-text-primary"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleEditTest(item.test)}
                        className="text-ams-danger h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ams-text-primary">
            测试项目
          </h3>
          <span className="text-xs text-ams-text-muted">
            器材已就绪 {readyCount} / {sortedItems.length}
          </span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            暂无测试项目
          </div>
        ) : (
          <div className="space-y-2">
            {sortedItems.map((item, idx) => {
              const ready = !!itemReadyState[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-ams border border-ams-border p-3 hover:border-ams-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary text-xs font-medium shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-ams bg-ams-surface text-ams-primary shrink-0">
                      {categoryIcons[item.test.category] || (
                        <Dumbbell className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ams-text-primary">
                          {item.test.name}
                        </span>
                        <span className="text-xs text-ams-text-muted">
                          {item.test.category}
                          {item.test.unit && ` · ${item.test.unit}`}
                        </span>
                      </div>
                      {item.allocatedMinutes !== null && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-ams-text-secondary">
                          <Clock className="h-3 w-3" />
                          分配时间 {item.allocatedMinutes} 分钟
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEquipmentReady(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        ready
                          ? 'bg-ams-success/10 text-ams-success hover:bg-ams-success/20'
                          : 'bg-ams-warning/10 text-ams-warning hover:bg-ams-warning/20'
                      }`}
                    >
                      {ready ? (
                        <>
                          <Check className="h-3 w-3" />
                          器材就绪
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          未就绪
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* 参与人员（编辑模式 / 查看模式） */}
      {isEditing ? (
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">
              编辑参与人员
            </h3>
            <span className="text-xs text-ams-text-muted">
              已选 {editParticipantIds.length} / {athletes.length} 人
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
            <input
              type="text"
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder="搜索运动员姓名..."
              className={inputClass.replace('px-3', 'pl-10 pr-4')}
            />
          </div>

          <div
            onClick={toggleSelectAllEditAthletes}
            className="flex items-center gap-3 rounded-ams border border-ams-border p-3 mb-2 cursor-pointer hover:bg-ams-surface-hover"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded border ${
                allEditSelected
                  ? 'border-ams-primary bg-ams-primary text-white'
                  : 'border-ams-border'
              }`}
            >
              {allEditSelected && <Check className="h-3 w-3" />}
            </div>
            <span className="text-sm font-medium text-ams-text-primary">
              全选
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-ams border border-ams-border">
            {editFilteredAthletes.length === 0 ? (
              <div className="py-8 text-center text-ams-text-muted text-sm">
                暂无匹配的运动员
              </div>
            ) : (
              <div className="divide-y divide-ams-border/50">
                {editFilteredAthletes.map((a) => {
                  const checked = editParticipantIds.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleEditParticipant(a.id)}
                      className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-ams-surface-hover ${
                        checked ? 'bg-ams-primary/5' : ''
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          checked
                            ? 'border-ams-primary bg-ams-primary text-white'
                            : 'border-ams-border'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <Users className="h-3.5 w-3.5 text-ams-text-muted" />
                      <span className="text-sm text-ams-text-primary">
                        {a.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ams-text-primary">
            参与人员
          </h3>
          <span className="text-xs text-ams-text-muted">
            共 {plan.participants.length} 人
          </span>
        </div>

        {plan.participants.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            暂无参与人员
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {plan.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-ams border border-ams-border bg-ams-surface p-2.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ams-primary/20 text-ams-primary text-xs font-medium shrink-0">
                  {p.athlete.name.charAt(0)}
                </div>
                <span className="text-sm text-ams-text-primary truncate">
                  {p.athlete.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* 器材汇总 */}
      <div className="ams-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ams-text-primary">
            器材汇总
          </h3>
          <span className="text-xs text-ams-text-muted">
            共 {equipment.length} 类器材
          </span>
        </div>

        {equipment.length === 0 ? (
          <div className="py-8 text-center text-ams-text-muted text-sm">
            <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
            暂无器材需求
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {equipment.map((eq) => (
              <div
                key={eq.name}
                className="flex items-center justify-between rounded-ams border border-ams-border bg-ams-surface p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-ams-primary shrink-0" />
                  <span className="text-sm text-ams-text-primary truncate">
                    {eq.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="rounded-full bg-ams-primary/20 px-2 py-0.5 text-xs font-medium text-ams-primary">
                    ×{eq.count}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      eq.ready
                        ? 'bg-ams-success/10 text-ams-success'
                        : 'bg-ams-warning/10 text-ams-warning'
                    }`}
                  >
                    {eq.ready ? '就绪' : '未就绪'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
