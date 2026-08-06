'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, User, Target, Dumbbell, Clock, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  dayOfWeek: number;
  exerciseId: number;
  exercise: Exercise;
  sets: number;
  reps: number;
  load: number | null;
  restSeconds: number | null;
  duration: number | null;
  intensity: string | null;
  sortOrder: number;
  notes: string | null;
}

interface TrainingPlan {
  id: number;
  coachId: number;
  goal: string | null;
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

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 来源列表记录键：由列表页进入详情前写入，供「返回列表」恢复筛选/分页状态 */
const PLAN_RETURN_KEY = 'ams-plan-list-return';

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-ams-text-secondary/10 text-ams-text-secondary' },
  PUBLISHED: { label: '已发布', color: 'bg-ams-primary/10 text-ams-primary' },
  COMPLETED: { label: '已完成', color: 'bg-ams-success/10 text-ams-success' },
};

const categoryIcons: Record<string, React.ReactNode> = {
  '力量': <Dumbbell className="h-4 w-4" />,
  '速度': <Clock className="h-4 w-4" />,
  '耐力': <Target className="h-4 w-4" />,
  '柔韧': <CalendarDays className="h-4 w-4" />,
  '技巧': <Check className="h-4 w-4" />,
  '恢复': <Clock className="h-4 w-4" />,
};

const intensityColors: Record<string, string> = {
  '低': 'bg-ams-success/15 text-ams-success',
  '中': 'bg-ams-primary/15 text-ams-primary',
  '高': 'bg-ams-danger/15 text-ams-danger',
};

export default function TrainingPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 导出相关状态
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
  const [exportAthleteId, setExportAthleteId] = useState<number | null>(null);
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);
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

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!plan) return;
    if (!exportAthleteId) { setExportMsg('请先选择运动员'); return; }
    if (!exportDate) { setExportMsg('请选择导出日期'); return; }

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

  const groupedItems = weekDays.map((_, idx) => {
    const dayItems = plan.items
      .filter(i => i.dayOfWeek === idx + 1)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { day: idx + 1, dayLabel: weekDays[idx], items: dayItems };
  });

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
          <Button variant="outline" size="sm" onClick={openAssignModal}>
            <UserPlus className="h-4 w-4" />
            分配运动员
          </Button>
          <Link href={`/training/plans/new`}>
            <Button variant="outline" size="sm">
              <Edit2 className="h-4 w-4" />
              新建副本
            </Button>
          </Link>
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
            </div>
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

      {/* 导出区域 */}
      <div className="ams-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4 text-ams-primary" />
          <h3 className="text-sm font-semibold text-ams-text-primary">导出训练计划</h3>
        </div>
        <p className="text-xs text-ams-text-muted mb-4">
          选择运动员和日期，将该运动员在指定日期（按星期几匹配）的训练安排导出为 PDF 或 Excel 文件。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
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
            <label className="block text-xs text-ams-text-muted mb-1">日期 *</label>
            <input
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-ams-text-muted mb-1">星期（自动识别）</label>
            <div className="px-3 py-2 text-sm text-ams-text-secondary rounded-ams bg-ams-surface border border-ams-border">
              {exportDate ? weekDays[(new Date(exportDate).getDay() + 6) % 7] : '-'}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={isExporting || !exportAthleteId}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('excel')}
              disabled={isExporting || !exportAthleteId}
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

      {/* 按天展示练习 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-ams-text-primary px-1">练习安排</h3>

        {groupedItems.map(({ day, dayLabel, items: dayItems }) => (
          <div key={day} className="ams-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-ams-text-primary">{dayLabel}</span>
              <span className="text-xs text-ams-text-muted">{dayItems.length} 个练习</span>
            </div>

            {dayItems.length === 0 ? (
              <p className="text-xs text-ams-text-muted py-4 text-center">当日无安排</p>
            ) : (
              <div className="space-y-2">
                {dayItems.map((item) => (
                  <div key={item.id} className="rounded-ams border border-ams-border p-3 hover:border-ams-primary/30 transition-colors">
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
                          {item.intensity && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${intensityColors[item.intensity] || 'bg-ams-surface text-ams-text-secondary'}`}>
                              {item.intensity}强度
                            </span>
                          )}
                        </div>
                        {item.exercise.targetMuscles && (
                          <p className="text-xs text-ams-text-muted mt-0.5">目标肌群：{item.exercise.targetMuscles}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                          <span className="text-ams-text-secondary">
                            <span className="font-medium text-ams-text-primary">{item.sets}</span> 组 × <span className="font-medium text-ams-text-primary">{item.reps}</span> 次
                          </span>
                          {item.load !== null && (
                            <span className="text-ams-text-secondary">
                              负荷 <span className="font-medium text-ams-text-primary">{item.load}</span> {item.exercise.unit}
                            </span>
                          )}
                          {item.duration !== null && item.duration !== undefined && (
                            <span className="text-ams-text-secondary">
                              时长 <span className="font-medium text-ams-text-primary">{item.duration}</span> 分钟
                            </span>
                          )}
                          {item.restSeconds !== null && item.restSeconds !== undefined && (
                            <span className="text-ams-text-secondary">
                              间歇 <span className="font-medium text-ams-text-primary">{item.restSeconds}</span> 秒
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-ams-text-muted mt-1 italic">备注：{item.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
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
    </div>
  );
}
