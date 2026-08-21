'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, User, Target, Dumbbell, Clock, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet, UserPlus, Search, Send, Info, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExercisePickerModal, { PickerExercise } from '@/app/(dashboard)/training/components/ExercisePickerModal';
import PlanItemEditor, { EditablePlanItem } from '@/app/(dashboard)/training/components/PlanItemEditor';

interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  difficulty: string | null;
  targetMuscles: string | null;
}

interface PlanItem {
  id: number;
  athleteId: number | null;
  athlete: { id: number; name: string } | null;
  exerciseId: number;
  exercise: Exercise;
  sets: number;
  reps: number;
  load: number | null;
  restSeconds: number | null;
  duration: number | null;
  tempo: string | null;
  sortOrder: number;
  notes: string | null;
}

interface TrainingPlan {
  id: number;
  coachId: number;
  goal: string | null;
  startDate: string | null;
  startTime: string | null;
  status: string;
  createdAt: string;
  planAthletes: { athlete: { id: number; name: string } }[];
  coach: { id: number; name: string };
  items: PlanItem[];
}

interface Athlete {
  id: number;
  name: string;
}

/** 来源列表记录键：由列表页进入详情前写入，供「返回列表」恢复筛选/分页状态 */
const PLAN_RETURN_KEY = 'ams-plan-list-return';

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-ams-text-secondary/10 text-ams-text-secondary' },
  SCHEDULED: { label: '待执行', color: 'bg-ams-primary/10 text-ams-primary' },
  COMPLETED: { label: '已执行', color: 'bg-ams-success/10 text-ams-success' },
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 执行时间展示格式：YYYY-MM-DD-周X HH:MM（星期按北京时间计算，与 UTC 零点日期一致） */
function formatExecuteTime(startDate: string | null, startTime: string | null): string {
  if (!startDate) return '-';
  const dateStr = startDate.slice(0, 10);
  const weekday = WEEKDAYS[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];
  return `${dateStr}-${weekday}${startTime ? ` ${startTime}` : ''}`;
}

const categoryIcons: Record<string, React.ReactNode> = {
  '力量': <Dumbbell className="h-4 w-4" />,
  '速度': <Clock className="h-4 w-4" />,
  '耐力': <Target className="h-4 w-4" />,
  '柔韧': <CalendarDays className="h-4 w-4" />,
  '技巧': <Check className="h-4 w-4" />,
  '恢复': <Clock className="h-4 w-4" />,
};

/** 练习参数统一展示顺序：负荷 → 次数 → 时长 → 组数 → 间歇 → 节奏 → 备注 */
const PARAM_ORDER = ['load', 'reps', 'duration', 'sets', 'restSeconds', 'tempo', 'notes'] as const;

export default function TrainingPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 导出相关状态
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
  const [exportAthleteId, setExportAthleteId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  // 分配运动员相关状态
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAthleteIds, setAssignAthleteIds] = useState<number[]>([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // 删除确认弹窗状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 发布状态
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  // 草稿编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ startDate: '', startTime: '' });
  const [editItems, setEditItems] = useState<EditablePlanItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  /** 练习选择弹窗当前面向的运动员（独立配置模式下的分组添加） */
  const [pickerTargetAthleteId, setPickerTargetAthleteId] = useState<number | null>(null);
  const [exercises, setExercises] = useState<PickerExercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    fetch(`/api/training/plans/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setPlan(json.data);
        else setError(json.error?.message || '加载失败');
      })
      .catch(() => setError('网络错误'))
      .finally(() => setIsLoading(false));

    fetch('/api/athletes?pageSize=100')
      .then(r => r.json())
      .then(json => {
        if (json.success) setAllAthletes(json.data.athletes);
      });
  }, [params.id]);

  /**
   * 返回列表：优先回到来源列表页（保留筛选/分页状态），
   * 无来源记录（如直接访问详情页）时默认回到「体能训练管理」界面的训练计划 Tab。
   */
  const getReturnUrl = () => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(PLAN_RETURN_KEY);
      if (saved) {
        sessionStorage.removeItem(PLAN_RETURN_KEY);
        return saved;
      }
    }
    return '/training?tab=plans';
  };

  const handleBackToList = () => {
    router.push(getReturnUrl());
  };

  const handleDeleteClick = () => {
    if (!plan) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!plan) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/training/plans/${plan.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        // 先关闭弹窗并清空本地状态，避免卸载/跳转竞态
        setShowDeleteConfirm(false);
        setPlan(null);
        router.replace(getReturnUrl());
      } else {
        setShowDeleteConfirm(false);
        alert(json.error?.message || '删除失败');
      }
    } catch {
      setShowDeleteConfirm(false);
      alert('网络错误');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublish = async () => {
    if (!plan) return;
    setIsPublishing(true);
    setPublishMsg('');
    try {
      const res = await fetch(`/api/training/plans/${plan.id}/publish`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        const statusLabel = statusLabels[json.data.status]?.label || json.data.status;
        setPublishMsg(`发布成功，状态已更新为「${statusLabel}」`);
      } else {
        setPublishMsg(json.error?.message || '发布失败');
      }
    } catch {
      setPublishMsg('网络错误');
    } finally {
      setIsPublishing(false);
    }
  };

  const fetchExercises = useCallback(async () => {
    try {
      const res = await fetch('/api/exercises?pageSize=200');
      const json = await res.json();
      if (json.success) setExercises(json.data.exercises);
    } catch { /* empty */ }
  }, []);

  /** 进入草稿编辑模式：以当前计划数据填充编辑表单 */
  const startEdit = () => {
    if (!plan) return;
    setEditForm({
      startDate: plan.startDate ? plan.startDate.slice(0, 10) : '',
      startTime: plan.startTime || '',
    });
    setEditItems(plan.items.map((item) => ({
      id: `existing-${item.id}`,
      athleteId: item.athleteId,
      exerciseId: item.exerciseId,
      exercise: item.exercise,
      sets: item.sets,
      reps: item.reps,
      load: item.load,
      restSeconds: item.restSeconds,
      duration: item.duration,
      tempo: item.tempo || '',
      sortOrder: item.sortOrder,
      notes: item.notes || '',
    })));
    setEditError('');
    setSaveMsg('');
    fetchExercises();
    setIsEditing(true);
  };

  /** 草稿编辑是否采用「共享配置」（所有练习项未指定运动员，兼容历史数据） */
  const isSharedItems = editItems.every((i) => i.athleteId == null);

  const openPickerFor = (athleteId: number | null) => {
    setPickerTargetAthleteId(athleteId);
    fetchExercises();
    setShowPicker(true);
  };

  const addItemsToPlan = (selected: PickerExercise[]) => {
    // 共享模式下补充运动员维度的练习仍统一为空（athleteId null）；独立模式下按分组目标运动员添加
    const targetAthleteId = isSharedItems ? null : pickerTargetAthleteId;
    if (!isSharedItems && targetAthleteId == null) return;
    const base = editItems
      .filter((i) => i.athleteId === targetAthleteId)
      .reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;
    const newItems: EditablePlanItem[] = selected.map((exercise, i) => ({
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
    setEditItems(prev => [...prev, ...newItems]);
    setShowPicker(false);
  };

  const updateEditItem = (id: string, updates: Partial<EditablePlanItem>) => {
    setEditItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeEditItem = (id: string) => {
    setEditItems(prev => prev.filter(i => i.id !== id));
  };

  const moveEditItem = (id: string, direction: 'up' | 'down') => {
    setEditItems(prev => {
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
      const order = new Map<string, number>();
      let n = 0;
      for (const { i, index } of groupIdxList) {
        order.set(next[index].id, n);
        n += 1;
      }
      return next.map(i => (order.has(i.id) ? { ...i, sortOrder: order.get(i.id)! } : i));
    });
  };

  /** 保存草稿编辑：更新执行时间与练习安排，保持草稿状态 */
  const handleSaveEdit = async () => {
    if (!plan) return;
    if (showPicker) { setEditError('请先完成练习选择'); return; }
    setIsSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/training/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: editForm.startDate || null,
          startTime: editForm.startTime || null,
          status: 'DRAFT',
          items: editItems.map(i => ({
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
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        setIsEditing(false);
        setSaveMsg('保存成功，草稿内容已更新');
      } else {
        setEditError(json.error?.message || '保存失败');
      }
    } catch {
      setEditError('网络错误');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!plan) return;
    if (!exportAthleteId) { setExportMsg('请先选择运动员'); return; }
    // 导出日期 = 计划执行开始日期
    const exportDate = plan.startDate ? plan.startDate.slice(0, 10) : '';
    if (!exportDate) { setExportMsg('该计划未设置执行开始日期，无法导出'); return; }

    setIsExporting(true);
    setExportMsg('');
    try {
      const athlete = allAthletes.find(a => a.id === exportAthleteId);
      const params = new URLSearchParams({
        athleteId: String(exportAthleteId),
        date: exportDate,
        format,
        athleteName: athlete?.name || `athlete-${exportAthleteId}`,
      });
      const res = await fetch(`/api/training/plans/${plan.id}/export?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training-plan-${athlete?.name || exportAthleteId}-${exportDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMsg(`已成功导出 ${format.toUpperCase()} 文件`);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const openAssignModal = () => {
    if (!plan) return;
    setAssignAthleteIds(plan.planAthletes.map(pa => pa.athlete.id));
    setAssignSearch('');
    setShowAssignModal(true);
  };

  const toggleAssignAthlete = (id: number) => {
    setAssignAthleteIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (!plan) return;
    if (assignAthleteIds.length === 0) { alert('请至少选择一名运动员'); return; }
    setIsAssigning(true);
    try {
      const res = await fetch(`/api/training/plans/${plan.id}/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteIds: assignAthleteIds }),
      });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        setShowAssignModal(false);
      } else {
        alert(json.error?.message || '分配失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ams-text-secondary">加载中...</div>
    );
  }

  if (error || !plan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </div>
        <div className="ams-card py-16 text-center text-ams-text-secondary">
          {error || '训练计划不存在'}
        </div>
      </div>
    );
  }

  const sortedItems = [...plan.items].sort((a, b) => a.sortOrder - b.sortOrder);
  /** 是否按运动员独立配置（存在任一带 athleteId 的练习项即视为独立配置） */
  const isIndependent = plan.items.some((i) => i.athleteId != null);

  const statusInfo = statusLabels[plan.status] || { label: plan.status, color: 'bg-ams-surface text-ams-text-secondary' };
  const filteredAssignAthletes = allAthletes.filter(a =>
    !assignSearch || a.name.toLowerCase().includes(assignSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 头部操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
          <h2 className="text-xl font-semibold text-ams-text-primary">训练计划详情</h2>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === 'DRAFT' && (
            <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
              <Send className="h-4 w-4" />
              {isPublishing ? '发布中...' : '发布'}
            </Button>
          )}
          {plan.status === 'DRAFT' && (
            <Button variant="outline" size="sm" onClick={startEdit} disabled={isPublishing}>
              <Edit2 className="h-4 w-4" />
              编辑
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={openAssignModal}>
            <UserPlus className="h-4 w-4" />
            分配运动员
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteClick} className="text-ams-danger border-ams-danger/30 hover:bg-ams-danger/10">
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {/* 基本信息卡片 */}
      <div className="ams-card p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {plan.status === 'DRAFT' && (
                <span className="flex items-center gap-1 text-xs text-ams-text-muted">
                  <Info className="h-3.5 w-3.5" />
                  草稿尚未发布，发布后按执行时间自动判定为待执行或已执行
                </span>
              )}
            </div>
            {publishMsg && (
              <div className={`rounded-ams px-3 py-2 text-xs ${
                publishMsg.includes('成功') ? 'bg-ams-success/10 text-ams-success' : 'bg-ams-danger/10 text-ams-danger'
              }`}>
                {publishMsg}
              </div>
            )}
            {saveMsg && (
              <div className="rounded-ams px-3 py-2 text-xs bg-ams-success/10 text-ams-success">
                {saveMsg}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2 text-ams-text-secondary">
                <User className="h-4 w-4 text-ams-text-muted mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {plan.planAthletes.length > 0 ? (
                    plan.planAthletes.map((pa) => (
                      <span key={pa.athlete.id} className="inline-flex items-center rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs text-ams-primary">
                        {pa.athlete.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ams-text-muted">未分配，点击右上角&ldquo;分配运动员&rdquo;</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-ams-text-secondary">
                <User className="h-4 w-4 text-ams-text-muted" />
                <span>教练：{plan.coach.name}</span>
              </div>
              {plan.startDate && (
                <div className="flex items-center gap-2 text-ams-text-secondary sm:col-span-2">
                  <CalendarDays className="h-4 w-4 text-ams-text-muted" />
                  <span>
                    执行时间：
                    {formatExecuteTime(plan.startDate, plan.startTime)}
                  </span>
                </div>
              )}
            </div>
            {plan.goal && (
              <div className="flex items-start gap-2 mt-2 pt-3 border-t border-ams-border">
                <Target className="h-4 w-4 text-ams-primary mt-0.5" />
                <p className="text-sm text-ams-text-secondary">{plan.goal}</p>
              </div>
            )}
          </div>
          <div className="text-right text-sm text-ams-text-muted ml-4">
            <div>共 {plan.items.length} 个练习</div>
            <div className="text-xs">创建于 {new Date(plan.createdAt).toLocaleDateString('zh-CN')}</div>
          </div>
        </div>
      </div>

      {/* 草稿编辑区域 */}
      {isEditing && (
        <div className="ams-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ams-text-primary">编辑草稿</h3>
            <span className="text-xs text-ams-text-muted">修改执行时间与练习安排，保存后立即生效</span>
          </div>

          {/* 执行时间 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-ams-primary" />
              <h4 className="text-sm font-medium text-ams-text-primary">训练计划执行时间</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs text-ams-text-muted mb-1">开始日期</label>
                <input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-ams-text-muted mb-1">开始时间</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>
            </div>
          </div>

          {/* 练习安排 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-ams-text-primary">练习安排</h4>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ams-text-muted">共 {editItems.length} 个练习</span>
              </div>
            </div>
            {editItems.length === 0 ? (
              <div className="rounded-ams border border-dashed border-ams-border py-6 text-center text-sm text-ams-text-muted">
                暂无练习安排，点击各运动员分组下的「添加练习」为计划添加训练项目
              </div>
            ) : isSharedItems ? (
              /* 共享配置（历史数据）：扁平列表，新增练习统一为全员共享 */
              <div className="space-y-2">
                {[...editItems].sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx) => (
                  <PlanItemEditor
                    key={item.id}
                    item={item}
                    index={idx}
                    total={editItems.length}
                    onChange={updateEditItem}
                    onMove={moveEditItem}
                    onRemove={removeEditItem}
                  />
                ))}
                <div className="flex justify-end pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => openPickerFor(null)}>
                    <Plus className="h-3 w-3" />
                    添加练习（全员共享）
                  </Button>
                </div>
              </div>
            ) : (
              /* 独立配置：按运动员分组，完成一名运动员后再显示下一名 */
              <div className="space-y-4">
                {plan.planAthletes.map((pa) => {
                  const groupItems = editItems
                    .filter((i) => i.athleteId === pa.athlete.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  return (
                    <div key={pa.athlete.id} className="rounded-ams border border-ams-border/70 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ams-text-primary">{pa.athlete.name}</span>
                          <span className="text-xs text-ams-text-muted">{groupItems.length} 个练习</span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => openPickerFor(pa.athlete.id)}>
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
                              onChange={updateEditItem}
                              onMove={moveEditItem}
                              onRemove={removeEditItem}
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

          {editError && (
            <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
              {editError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? '保存中...' : '保存修改'}
            </Button>
          </div>
        </div>
      )}

      {/* 导出区域 */}
      <div className="ams-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4 text-ams-primary" />
          <h3 className="text-sm font-semibold text-ams-text-primary">导出训练计划</h3>
        </div>
        <p className="text-xs text-ams-text-muted mb-4">
          选择运动员，将该运动员在本计划中的全部练习安排导出为 PDF 或 Excel 文件（执行日期以计划开始日期为准）。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-ams-text-muted mb-1">运动员 *</label>
            <select
              value={exportAthleteId ?? ''}
              onChange={(e) => setExportAthleteId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">请选择</option>
              {plan.planAthletes.map((pa) => (
                <option key={pa.athlete.id} value={pa.athlete.id}>{pa.athlete.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ams-text-muted mb-1">执行日期（自动识别）</label>
            <div className="px-3 py-2 text-sm text-ams-text-secondary rounded-ams bg-ams-surface border border-ams-border">
              {plan.startDate ? formatExecuteTime(plan.startDate, null) : '未设置'}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={isExporting || !exportAthleteId || !plan.startDate}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('excel')}
              disabled={isExporting || !exportAthleteId || !plan.startDate}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>
        {isExporting && (
          <p className="mt-3 text-xs text-ams-text-muted">导出中，请稍候...</p>
        )}
        {exportMsg && !isExporting && (
          <p className={`mt-3 text-xs ${exportMsg.includes('成功') ? 'text-ams-success' : 'text-ams-danger'}`}>
            {exportMsg}
          </p>
        )}
      </div>

      {/* 练习安排 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-ams-text-primary px-1">
          练习安排（共 {plan.items.length} 个练习）
        </h3>

        {plan.items.length === 0 ? (
          <div className="ams-card p-4">
            <p className="text-xs text-ams-text-muted py-4 text-center">暂无练习安排</p>
          </div>
        ) : isIndependent ? (
          /* 独立配置：按运动员分组连续排列，完成一名运动员的所有练习后再显示下一名 */
          <div className="space-y-4">
            {plan.planAthletes.map((pa) => {
              const athleteItems = plan.items
                .filter((i) => i.athleteId === pa.athlete.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <div key={pa.athlete.id} className="ams-card p-4">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h4 className="text-sm font-semibold text-ams-text-primary">{pa.athlete.name}</h4>
                    <span className="text-xs text-ams-text-muted">{athleteItems.length} 个练习</span>
                  </div>
                  {athleteItems.length === 0 ? (
                    <p className="text-xs text-ams-text-muted py-3 text-center">该运动员暂无练习安排</p>
                  ) : (
                    <div className="space-y-2">
                      {athleteItems.map((item) => (
                        <PlanItemRow key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* 共享配置（历史数据）：全员共用同一组练习，扁平展示 */
          <div className="ams-card p-4">
            <div className="space-y-2">
              {sortedItems.map((item) => (
                <PlanItemRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 分配运动员弹窗 */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAssignModal(false)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-hidden ams-card flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-ams-border">
              <div>
                <h3 className="text-lg font-semibold text-ams-text-primary">分配运动员</h3>
                <p className="text-xs text-ams-text-muted">精准分配：以本次选择为准，已选 {assignAthleteIds.length} 人</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAssignModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 border-b border-ams-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="搜索运动员姓名..."
                  className="w-full rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredAssignAthletes.length === 0 ? (
                <div className="py-16 text-center text-ams-text-muted">暂无匹配的运动员</div>
              ) : (
                <div className="space-y-1">
                  {filteredAssignAthletes.map((a) => {
                    const checked = assignAthleteIds.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => toggleAssignAthlete(a.id)}
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
              <span className="text-xs text-ams-text-muted">共 {filteredAssignAthletes.length} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAssignModal(false)}>取消</Button>
                <Button onClick={handleAssign} disabled={isAssigning}>
                  {isAssigning ? '分配中...' : '确认分配'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { if (!isDeleting) setShowDeleteConfirm(false); }}>
          <div className="w-full max-w-sm ams-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ams-text-primary">删除训练计划</h3>
            <p className="mt-2 text-sm text-ams-text-secondary">
              确定删除此训练计划？此操作不可撤销。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 练习选择器弹窗（草稿编辑） */}
      {showPicker && (
        <ExercisePickerModal
          exercises={exercises}
          onClose={() => setShowPicker(false)}
          onSelect={addItemsToPlan}
        />
      )}
    </div>
  );
}

// ============================================================
// 练习项展示卡片：参数统一顺序为 负荷 → 次数 → 时长 → 组数 → 间歇 → 节奏 → 备注
// ============================================================

function PlanItemRow({ item }: { item: PlanItem }) {
  const params: { key: string; node: React.ReactNode }[] = [
    ...(item.load !== null && item.load !== undefined
      ? [{ key: 'load', node: (<span className="text-ams-text-secondary">负荷 <span className="font-medium text-ams-text-primary">{item.load}</span> {item.exercise.unit}</span>) }]
      : []),
    { key: 'reps', node: (<span className="text-ams-text-secondary">次数 <span className="font-medium text-ams-text-primary">{item.reps}</span> 次</span>) },
    ...(item.duration !== null && item.duration !== undefined
      ? [{ key: 'duration', node: (<span className="text-ams-text-secondary">时长 <span className="font-medium text-ams-text-primary">{item.duration}</span> 分钟</span>) }]
      : []),
    { key: 'sets', node: (<span className="text-ams-text-secondary">组数 <span className="font-medium text-ams-text-primary">{item.sets}</span> 组</span>) },
    ...(item.restSeconds !== null && item.restSeconds !== undefined
      ? [{ key: 'restSeconds', node: (<span className="text-ams-text-secondary">间歇 <span className="font-medium text-ams-text-primary">{item.restSeconds}</span> 秒</span>) }]
      : []),
    ...(item.tempo
      ? [{ key: 'tempo', node: (<span className="text-ams-text-secondary">节奏 <span className="font-medium text-ams-text-primary">{item.tempo}</span></span>) }]
      : []),
    ...(item.notes
      ? [{ key: 'notes', node: (<span className="text-ams-text-muted italic">备注：{item.notes}</span>) }]
      : []),
  ];
  // 按统一顺序渲染（数组本身已按顺序构造，此处保持展示顺序）
  const ordered = [...params].sort((a, b) => PARAM_ORDER.indexOf(a.key as (typeof PARAM_ORDER)[number]) - PARAM_ORDER.indexOf(b.key as (typeof PARAM_ORDER)[number]));

  return (
    <div className="rounded-ams border border-ams-border p-3 hover:border-ams-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary shrink-0">
          {categoryIcons[item.exercise.category] || <Dumbbell className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ams-text-primary">{item.exercise.name}</span>
            <span className="text-xs text-ams-text-muted">{item.exercise.category} · {item.exercise.unit}</span>
            {item.exercise.difficulty && (
              <span className="rounded-full px-2 py-0.5 text-xs bg-ams-surface-hover text-ams-text-secondary">
                {item.exercise.difficulty}
              </span>
            )}
          </div>
          {item.exercise.targetMuscles && (
            <p className="text-xs text-ams-text-muted mt-0.5">目标肌群：{item.exercise.targetMuscles}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
            {ordered.map((p) => <span key={p.key}>{p.node}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
