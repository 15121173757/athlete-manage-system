/**
 * 伤病管理视图 —— 伤病与负荷监控模块（Tab: 伤病管理）
 *
 * 功能：伤病记录列表、新增、编辑（含修改历史追踪）、删除、附件上传
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Paperclip,
  Download,
  History,
  X,
  AlertTriangle,
  Eye,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InjuryHistory {
  id: number;
  changes: string;
  note: string | null;
  createdAt: string;
  operator: { id: number; name: string; username: string };
}

interface Injury {
  id: number;
  athleteId: number;
  injuryType: string;
  description: string;
  bodyPart: string | null;
  cause: string | null;
  diagnosis: string | null;
  treatment: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  athlete: { id: number; name: string; sport?: string | null; position?: string | null };
  recoveryPlan: {
    id: number;
    content: string;
    status: string;
    startDate?: string;
    targetReturnDate?: string;
  } | null;
  history?: InjuryHistory[];
}

interface AthleteOption {
  id: number;
  name: string;
  sport: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  INJURED: { label: '受伤', color: 'text-ams-danger' },
  RECOVERING: { label: '康复中', color: 'text-ams-warning' },
  RETURNED: { label: '已回归', color: 'text-ams-success' },
};

const fieldLabels: Record<string, string> = {
  athleteId: '受伤人员',
  injuryType: '伤病类型',
  description: '描述',
  bodyPart: '受伤部位',
  cause: '受伤原因',
  diagnosis: '诊断结果',
  treatment: '治疗方案',
  startDate: '受伤日期',
  endDate: '痊愈日期',
  status: '状态',
};

function statusText(v: unknown): string {
  return statusLabels[String(v)]?.label ?? String(v ?? '');
}

function fmtValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '空';
  if (field === 'startDate' || field === 'endDate') {
    return new Date(String(value)).toLocaleDateString('zh-CN');
  }
  if (field === 'status') return statusText(value);
  return String(value);
}

/** ISO 时间转 input[type=date] 值（按本地时区，避免 UTC 偏移导致日期回退一天） */
function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 详情展示字段 */
function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ams-text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-ams-text-primary">{value ?? '空'}</div>
    </div>
  );
}

/** 修改历史列表（编辑弹窗与详情弹窗共用） */
function HistoryList({ history }: { history: InjuryHistory[] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-ams-text-muted">暂无修改记录</p>;
  }
  return (
    <ul className="max-h-48 space-y-2 overflow-y-auto">
      {history.map((h) => {
        let changes: Record<string, { before: unknown; after: unknown }> = {};
        try { changes = JSON.parse(h.changes); } catch { /* 忽略解析失败 */ }
        return (
          <li key={h.id} className="rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-ams-text-secondary">
              <span className="font-medium text-ams-text-primary">{h.operator.name}</span>
              <span>{new Date(h.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            {h.note && (
              <div className="mt-1 text-ams-warning">备注：{h.note}</div>
            )}
            <div className="mt-1 space-y-0.5 text-ams-text-muted">
              {Object.entries(changes).map(([field, v]) => (
                <div key={field}>
                  {fieldLabels[field] || field}：{fmtValue(field, v.before)} → {fmtValue(field, v.after)}
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 康复进度百分比（基于康复计划起止日期，无计划时按痊愈日期视为 100%） */
function recoveryProgress(injury: Injury): number {
  const plan = injury.recoveryPlan;
  if (plan?.startDate && plan.targetReturnDate) {
    const start = new Date(plan.startDate).getTime();
    const target = new Date(plan.targetReturnDate).getTime();
    if (target <= start) return 100;
    return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (target - start)) * 100)));
  }
  return injury.endDate ? 100 : 0;
}

/** 空表单模板 */
const emptyForm = {
  athleteId: '',
  injuryType: '',
  bodyPart: '',
  cause: '',
  diagnosis: '',
  treatment: '',
  description: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  status: 'INJURED',
  note: '',
};

type FormState = typeof emptyForm;

export default function InjuriesView() {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 弹窗
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Injury | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [history, setHistory] = useState<InjuryHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // 详情弹窗
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<Injury | null>(null);
  const [athleteInjuries, setAthleteInjuries] = useState<Injury[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/health/injuries?${params}`);
      const json = await res.json();
      if (json.success) {
        setInjuries(json.data.injuries);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadAthletes = () => {
    if (athletes.length > 0) return;
    fetch('/api/athletes?pageSize=100')
      .then((r) => r.json())
      .then((j) => { if (j.success) setAthletes(j.data.athletes); })
      .catch(() => {});
  };

  const loadHistory = (injuryId: number) => {
    setIsHistoryLoading(true);
    fetch(`/api/health/injuries/${injuryId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setHistory(j.data.history || []); })
      .catch(() => setHistory([]))
      .finally(() => setIsHistoryLoading(false));
  };

  /** 加载伤病详情 + 该运动员全部伤病记录（完整伤病历史） */
  const loadDetail = async (injuryId: number) => {
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/health/injuries/${injuryId}`);
      const json = await res.json();
      if (!json.success) return;
      setDetail(json.data);
      const listRes = await fetch(`/api/health/injuries?athleteId=${json.data.athleteId}&pageSize=100`);
      const listJson = await listRes.json();
      if (listJson.success) setAthleteInjuries(listJson.data.injuries);
    } catch { /* 网络错误保持现状 */ }
    finally { setIsDetailLoading(false); }
  };

  /** 打开详情弹窗（点击行任意位置触发） */
  const openDetail = (injury: Injury) => {
    setDetail(null);
    setAthleteInjuries([]);
    setShowDetail(true);
    loadDetail(injury.id);
  };

  const openCreate = () => {
    loadAthletes();
    setEditing(null);
    setForm(emptyForm);
    setAttachment(null);
    setHistory([]);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (injury: Injury) => {
    loadAthletes();
    setEditing(injury);
    setForm({
      athleteId: String(injury.athleteId),
      injuryType: injury.injuryType,
      bodyPart: injury.bodyPart || '',
      cause: injury.cause || '',
      diagnosis: injury.diagnosis || '',
      treatment: injury.treatment || '',
      description: injury.description,
      startDate: toDateInput(injury.startDate),
      endDate: toDateInput(injury.endDate),
      status: injury.status,
      note: '',
    });
    setAttachment(null);
    setFormError('');
    setHistory([]);
    setShowForm(true);
    loadHistory(injury.id);
  };

  const handleDelete = async (injury: Injury) => {
    if (!confirm(`确定删除「${injury.athlete.name}」的伤病记录（${injury.injuryType}）？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/health/injuries/${injury.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert(json.error?.message || '删除失败');
      }
    } catch {
      alert('网络错误，删除失败');
    }
  };

  /** 上传附件（新增或编辑后） */
  const uploadAttachment = async (injuryId: number) => {
    if (!attachment) return;
    const fd = new FormData();
    fd.append('file', attachment);
    const res = await fetch(`/api/health/injuries/${injuryId}/attachment`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || '附件上传失败');
  };

  const handleSubmit = async () => {
    setFormError('');
    const athleteId = parseInt(form.athleteId);
    if (!form.athleteId || isNaN(athleteId)) { setFormError('请选择受伤人员'); return; }
    if (!form.injuryType.trim()) { setFormError('伤病类型不能为空'); return; }
    if (!form.bodyPart.trim()) { setFormError('受伤部位不能为空'); return; }
    if (!form.cause.trim()) { setFormError('受伤原因不能为空'); return; }
    if (!form.diagnosis.trim()) { setFormError('诊断结果不能为空'); return; }
    if (!form.treatment.trim()) { setFormError('治疗方案不能为空'); return; }
    if (!form.startDate) { setFormError('受伤日期不能为空'); return; }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        athleteId,
        injuryType: form.injuryType.trim(),
        bodyPart: form.bodyPart.trim(),
        cause: form.cause.trim(),
        diagnosis: form.diagnosis.trim(),
        treatment: form.treatment.trim(),
        description: form.description.trim() || '无',
        startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
        endDate: form.endDate ? new Date(`${form.endDate}T00:00:00`).toISOString() : null,
        status: form.status,
      };

      let injuryId: number;
      if (editing) {
        const res = await fetch(`/api/health/injuries/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, note: form.note.trim() || undefined }),
        });
        const json = await res.json();
        if (!json.success) { setFormError(json.error?.message || '保存失败'); setIsSaving(false); return; }
        injuryId = editing.id;
      } else {
        const res = await fetch('/api/health/injuries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) { setFormError(json.error?.message || '保存失败'); setIsSaving(false); return; }
        injuryId = json.data.id;
      }

      // 附件上传（失败则提示但记录已保存）
      try {
        await uploadAttachment(injuryId);
      } catch (e) {
        alert(e instanceof Error ? e.message : '附件上传失败，伤病记录已保存');
      }

      setShowForm(false);
      fetchData();
    } catch {
      setFormError('网络错误');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">伤病管理</h2>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />新增伤病记录</Button>
      </div>

      <div className="ams-card p-4">
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
            <option value="">全部状态</option>
            <option value="INJURED">受伤</option>
            <option value="RECOVERING">康复中</option>
            <option value="RETURNED">已回归</option>
          </select>
        </div>
      </div>

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : injuries.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">
            暂无伤病记录
            <p className="mt-1 text-xs text-ams-text-muted">点击右上角「新增伤病记录」开始录入</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">运动员</th>
                    <th className="px-4 py-3 text-left ams-table-header">伤病类型</th>
                    <th className="px-4 py-3 text-left ams-table-header">受伤部位</th>
                    <th className="px-4 py-3 text-left ams-table-header">描述</th>
                    <th className="px-4 py-3 text-left ams-table-header">开始日期</th>
                    <th className="px-4 py-3 text-left ams-table-header">状态</th>
                    <th className="px-4 py-3 text-left ams-table-header">附件</th>
                    <th className="px-4 py-3 text-right ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {injuries.map((i) => {
                    const s = statusLabels[i.status] || { label: i.status, color: 'text-ams-text-secondary' };
                    return (
                      <tr
                        key={i.id}
                        onClick={() => openDetail(i)}
                        className="group cursor-pointer border-b border-ams-border/50 transition-colors duration-150 hover:bg-ams-primary/10 hover:shadow-[inset_2px_0_0_0_#FF6B35]"
                      >
                        <td className="px-4 py-3 text-ams-text-primary">
                          <span className="inline-flex items-center gap-2">
                            {i.athlete.name}
                            <span className="inline-flex items-center gap-1 text-xs text-ams-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                              <Eye className="h-3.5 w-3.5" />
                              查看详情
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">{i.injuryType}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">{i.bodyPart || '-'}</td>
                        <td className="px-4 py-3 text-ams-text-secondary max-w-[160px] truncate">{i.description}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">{new Date(i.startDate).toLocaleDateString('zh-CN')}</td>
                        <td className={`px-4 py-3 font-medium ${s.color}`}>{s.label}</td>
                        <td className="px-4 py-3">
                          {i.attachmentName ? (
                            <a
                              href={i.attachmentPath || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex max-w-[140px] items-center gap-1 truncate text-xs text-ams-info hover:underline"
                              title={i.attachmentName}
                            >
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{i.attachmentName}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-ams-text-muted">无</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="编辑" onClick={(e) => { e.stopPropagation(); openEdit(i); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="删除" onClick={(e) => { e.stopPropagation(); handleDelete(i); }}>
                            <Trash2 className="h-4 w-4 text-ams-danger" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ams-border px-4 py-3">
                <div className="text-sm text-ams-text-secondary">共 {total} 条</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ 新增 / 编辑伤病记录弹窗 ============ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-ams border border-ams-border bg-ams-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ams-text-primary">
                {editing ? '编辑伤病记录' : '新增伤病记录'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">受伤人员 *</label>
                <select
                  value={form.athleteId}
                  onChange={(e) => setForm({ ...form, athleteId: e.target.value })}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                >
                  <option value="">请选择运动员</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.sport ? `（${a.sport}）` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">受伤时间 *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">伤病类型 *</label>
                <input
                  type="text"
                  value={form.injuryType}
                  onChange={(e) => setForm({ ...form, injuryType: e.target.value })}
                  placeholder="如：韧带拉伤"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">受伤部位 *</label>
                <input
                  type="text"
                  value={form.bodyPart}
                  onChange={(e) => setForm({ ...form, bodyPart: e.target.value })}
                  placeholder="如：右膝"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">受伤原因 *</label>
                <input
                  type="text"
                  value={form.cause}
                  onChange={(e) => setForm({ ...form, cause: e.target.value })}
                  placeholder="如：训练强度过大"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">诊断结果 *</label>
                <input
                  type="text"
                  value={form.diagnosis}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  placeholder="如：前交叉韧带轻度撕裂"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                >
                  <option value="INJURED">受伤</option>
                  <option value="RECOVERING">康复中</option>
                  <option value="RETURNED">已回归</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ams-text-muted">痊愈日期（可选）</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-ams-text-muted">治疗方案 *</label>
                <textarea
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  rows={2}
                  placeholder="如：休息制动、冰敷、康复训练计划..."
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-ams-text-muted">描述 *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="伤病情况描述..."
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-ams-text-muted">
                  附件（诊断报告 / 影像资料，可选，≤10MB：JPG/PNG/WEBP/GIF/PDF）
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-ams border border-dashed border-ams-border px-3 py-2 text-sm text-ams-text-secondary hover:border-ams-primary">
                    <Paperclip className="h-4 w-4" />
                    {attachment ? attachment.name : (editing?.attachmentName ? '替换附件' : '选择文件')}
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                  </label>
                  {editing?.attachmentName && !attachment && (
                    <a
                      href={editing.attachmentPath || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-ams-info hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      当前附件：{editing.attachmentName}
                    </a>
                  )}
                  {attachment && (
                    <button
                      type="button"
                      className="text-xs text-ams-text-muted hover:text-ams-danger"
                      onClick={() => setAttachment(null)}
                    >
                      移除
                    </button>
                  )}
                </div>
              </div>

              {editing && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-ams-text-muted">变更备注（可选，将记录在修改历史中）</label>
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="如：根据复查结果更新诊断"
                    className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* 修改历史（仅编辑模式） */}
            {editing && (
              <div className="mt-5 rounded-ams border border-ams-border bg-ams-background/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <History className="h-4 w-4 text-ams-info" />
                  <span className="text-sm font-medium text-ams-text-primary">修改历史</span>
                </div>
                {isHistoryLoading ? (
                  <p className="text-xs text-ams-text-muted">加载中...</p>
                ) : (
                  <HistoryList history={history} />
                )}
              </div>
            )}

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-ams bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>取消</Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 运动员伤病详情弹窗（点击行触发） ============ */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-ams border border-ams-border bg-ams-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-ams-text-primary">运动员伤病详情</h3>
                {detail && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-base font-medium text-ams-text-primary">{detail.athlete.name}</span>
                    {detail.athlete.sport && <span className="text-ams-text-secondary">{detail.athlete.sport}</span>}
                    {detail.athlete.position && <span className="text-ams-text-secondary">· {detail.athlete.position}</span>}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isDetailLoading && !detail ? (
              <p className="py-10 text-center text-sm text-ams-text-secondary">加载中...</p>
            ) : detail ? (
              <div className="space-y-5">
                {/* 当前伤情状态 */}
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-ams-warning" />
                    <h4 className="text-sm font-semibold text-ams-text-primary">当前伤情状态</h4>
                    {(() => {
                      const s = statusLabels[detail.status] || { label: detail.status, color: 'text-ams-text-secondary' };
                      return (
                        <span className={`rounded-full border border-current px-2 py-0.5 text-xs font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-1 gap-3 rounded-ams border border-ams-border/60 bg-ams-background/60 p-4 sm:grid-cols-2">
                    <DetailField label="伤病类型" value={detail.injuryType} />
                    <DetailField label="受伤部位" value={detail.bodyPart} />
                    <DetailField label="受伤日期" value={new Date(detail.startDate).toLocaleDateString('zh-CN')} />
                    <DetailField
                      label="痊愈日期"
                      value={detail.endDate ? new Date(detail.endDate).toLocaleDateString('zh-CN') : '未痊愈'}
                    />
                    <DetailField label="受伤原因" value={detail.cause} />
                    <DetailField
                      label="附件"
                      value={
                        detail.attachmentName ? (
                          <a
                            href={detail.attachmentPath || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-ams-info hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {detail.attachmentName}
                          </a>
                        ) : undefined
                      }
                    />
                    <div className="sm:col-span-2">
                      <DetailField label="诊断结果" value={detail.diagnosis} />
                    </div>
                    <div className="sm:col-span-2">
                      <DetailField label="治疗方案" value={detail.treatment} />
                    </div>
                    <div className="sm:col-span-2">
                      <DetailField label="描述" value={detail.description} />
                    </div>
                  </div>
                </section>

                {/* 康复计划与恢复进度 */}
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <Download className="h-4 w-4 text-ams-info" />
                    <h4 className="text-sm font-semibold text-ams-text-primary">康复计划与恢复进度</h4>
                  </div>
                  {detail.recoveryPlan ? (
                    <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-3">
                          <DetailField label="康复内容" value={detail.recoveryPlan.content} />
                        </div>
                        <DetailField
                          label="开始日期"
                          value={detail.recoveryPlan.startDate ? new Date(detail.recoveryPlan.startDate).toLocaleDateString('zh-CN') : undefined}
                        />
                        <DetailField
                          label="目标回归日期"
                          value={detail.recoveryPlan.targetReturnDate ? new Date(detail.recoveryPlan.targetReturnDate).toLocaleDateString('zh-CN') : undefined}
                        />
                        <DetailField label="计划状态" value={detail.recoveryPlan.status} />
                      </div>
                      {detail.status !== 'RETURNED' && (() => {
                        const progress = recoveryProgress(detail);
                        return (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-ams-text-muted">恢复进度</span>
                              <span className="text-ams-text-secondary">{progress}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ams-background">
                              <div
                                className="h-full rounded-full bg-ams-success transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-4 text-sm text-ams-text-muted">
                      暂无康复计划
                    </p>
                  )}
                </section>

                {/* 修改历史 */}
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <History className="h-4 w-4 text-ams-info" />
                    <h4 className="text-sm font-semibold text-ams-text-primary">修改历史</h4>
                  </div>
                  <HistoryList history={detail.history || []} />
                </section>

                {/* 完整伤病历史（该运动员全部伤病记录） */}
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-ams-primary" />
                    <h4 className="text-sm font-semibold text-ams-text-primary">完整伤病历史</h4>
                    <span className="text-xs text-ams-text-muted">共 {athleteInjuries.length} 条，点击切换查看</span>
                  </div>
                  {athleteInjuries.length === 0 ? (
                    <p className="text-sm text-ams-text-muted">暂无其他伤病记录</p>
                  ) : (
                    <ul className="space-y-2">
                      {athleteInjuries.map((a) => {
                        const as = statusLabels[a.status] || { label: a.status, color: 'text-ams-text-secondary' };
                        const active = a.id === detail.id;
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => loadDetail(a.id)}
                              className={`flex w-full items-center justify-between gap-2 rounded-ams border px-3 py-2 text-left text-sm transition-colors ${
                                active
                                  ? 'border-ams-primary bg-ams-primary/10 text-ams-text-primary'
                                  : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50 hover:bg-ams-surface-hover'
                              }`}
                            >
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-ams-primary' : 'text-ams-text-muted'}`} />
                                <span className="truncate">{a.injuryType}</span>
                                {a.bodyPart && <span className="shrink-0 text-xs text-ams-text-muted">{a.bodyPart}</span>}
                              </span>
                              <span className={`shrink-0 text-xs font-medium ${as.color}`}>{as.label}</span>
                            </button>
                            <div className="mt-0.5 pl-9 text-xs text-ams-text-muted">
                              {new Date(a.startDate).toLocaleDateString('zh-CN')} 受伤
                              {a.endDate ? ` · ${new Date(a.endDate).toLocaleDateString('zh-CN')} 痊愈` : ''}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
