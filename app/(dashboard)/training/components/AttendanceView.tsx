'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ClipboardCheck,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  Users,
  Check,
  RotateCcw,
  Download,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_STATUSES,
  getAttendanceStatusColor,
  getAttendanceStatusLabel,
  type AttendanceStatusCode,
} from '@/lib/attendance/attendance-types';

// ============================================================
// 类型定义
// ============================================================

interface SheetRow {
  athleteId: number;
  name: string;
  sport: string;
  position: string | null;
  source: 'PLAN' | 'MANUAL';
  planCount: number;
  status: AttendanceStatusCode | null;
  /** 自觉劳累程度（1-10，null 表示未填写） */
  rpe: number | null;
  /** 训练时长（分钟，null 表示未填写） */
  durationMinutes: number | null;
  /** 训练负荷（= RPE × 训练时长，任一为空时为 null） */
  load: number | null;
  notes: string | null;
}

interface AttendanceSheet {
  date: string;
  dayOfWeek: number;
  rows: SheetRow[];
  availableAthletes: { id: number; name: string; sport: string }[];
}

interface StatusCount {
  status: AttendanceStatusCode;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

interface ScheduleCell {
  date: string;
  dayOfWeek: number;
  scheduled: boolean;
  status: AttendanceStatusCode | null;
}

interface IndividualReport {
  dimension: 'individual';
  athlete: { id: number; name: string; sport: string };
  range: { startDate: string; endDate: string };
  totalPlans: number;
  planCount: number;
  markedCount: number;
  unmarkedCount: number;
  statusCounts: StatusCount[];
  schedule: ScheduleCell[];
}

interface TeamMemberRow {
  athleteId: number;
  name: string;
  sport: string;
  planCount: number;
  markedCount: number;
  statusCounts: StatusCount[];
}

interface TeamReport {
  dimension: 'team';
  range: { startDate: string; endDate: string };
  planCount: number;
  markedCount: number;
  unmarkedCount: number;
  statusCounts: StatusCount[];
  members: TeamMemberRow[];
}

type AttendanceReport = IndividualReport | TeamReport;

// ============================================================
// 工具函数
// ============================================================

function todayStr(): string {
  const d = new Date();
  return toDateStr(d);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** 计算起止日期之间涵盖的总天数（含首尾，如 08-01 ~ 08-14 = 14 天） */
function daysBetween(startStr: string, endStr: string): number {
  const s = new Date(`${startStr}T00:00:00`);
  const e = new Date(`${endStr}T00:00:00`);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// ============================================================
// 出勤状态选择器（6 个固定状态按钮）
// ============================================================

function StatusPicker({
  value,
  onChange,
  size = 'sm',
}: {
  value: AttendanceStatusCode | null;
  onChange: (code: AttendanceStatusCode) => void;
  size?: 'sm' | 'xs';
}) {
  const chip = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ATTENDANCE_STATUSES.map((s) => {
        const active = value === s.code;
        return (
          <button
            key={s.code}
            type="button"
            onClick={() => onChange(s.code)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border transition-colors',
              chip,
              active
                ? 'border-transparent text-white'
                : 'border-ams-border bg-ams-background/60 text-ams-text-secondary hover:border-ams-text-muted'
            )}
            style={active ? { backgroundColor: s.color } : undefined}
            title={s.label}
          >
            {!active && (
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            )}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 负荷数值输入框（RPE / 训练时长）
// 范围校验在失焦/回车时触发，非法输入给出内联错误提示
// ============================================================

function LoadInput({
  value,
  min,
  max = Number.MAX_SAFE_INTEGER,
  placeholder,
  hint,
  disabled,
  onCommit,
}: {
  value: number | null;
  min: number;
  max?: number;
  placeholder?: string;
  hint: string;
  disabled?: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [error, setError] = useState('');

  // 外部数据刷新后同步显示值；输入存在错误时保留用户草稿不清除
  useEffect(() => {
    if (!error) setDraft(value == null ? '' : String(value));
  }, [value, error]);

  const commit = () => {
    const t = draft.trim();
    if (t === '') {
      setError('');
      onCommit(null);
      return;
    }
    const n = Number(t);
    if (!Number.isInteger(n) || n < min || n > max) {
      setError(hint);
      return;
    }
    setError('');
    onCommit(n);
  };

  return (
    <div className="w-20">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError('');
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          'w-full rounded-ams border bg-ams-background px-2 py-1.5 text-right text-sm text-ams-text-primary',
          error ? 'border-ams-danger' : 'border-ams-border focus:border-ams-primary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />
      {error && <div className="mt-1 text-[10px] leading-tight text-ams-danger">{error}</div>}
    </div>
  );
}

// ============================================================
// 出勤表
// ============================================================

function SheetView() {
  const [date, setDate] = useState(todayStr());
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  // 手动添加弹窗
  const [showAdd, setShowAdd] = useState(false);
  const [addAthleteId, setAddAthleteId] = useState<number>(0);
  const [addStatus, setAddStatus] = useState<AttendanceStatusCode>('PRESENT');

  /**
   * 拉取出勤表数据
   * silent 模式（保存 / 重置 / 添加后调用）：不切换加载态、不卸载表格 DOM，
   * 保证行内输入框焦点与页面滚动位置稳定，避免「保存后闪跳回表格开头」的问题
   */
  const fetchSheet = useCallback(async (d: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/attendance/sheet?date=${d}`);
      const json = await res.json();
      if (json.success) setSheet(json.data);
      else setError(json.error?.message || '加载失败');
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheet(date);
  }, [date, fetchSheet]);

  const setStatus = async (athleteId: number, status: AttendanceStatusCode) => {
    await saveRow(athleteId, { status });
  };

  // 最新出勤表数据的引用（供排队的保存任务读取最新值，避免读到过期状态）
  const sheetRef = useRef<AttendanceSheet | null>(null);
  sheetRef.current = sheet;
  // 同一运动员的保存请求串行执行：连续填写 RPE / 训练时长时，
  // 后一次提交能读到前一次保存后的最新值，防止快速连续提交互相覆盖
  const pendingSavesRef = useRef<Map<number, Promise<unknown>>>(new Map());

  /**
   * 保存出勤行数据（出勤状态 / RPE / 训练时长）
   * 后端 upsert 会整体写入三个字段，因此保存时始终携带当前行的全部值，避免相互覆盖
   */
  const saveRow = async (
    athleteId: number,
    patch: { status?: AttendanceStatusCode; rpe?: number | null; durationMinutes?: number | null }
  ) => {
    const prev = pendingSavesRef.current.get(athleteId) ?? Promise.resolve();
    const task = prev.then(async () => {
      const row = sheetRef.current?.rows.find((r) => r.athleteId === athleteId);
      if (!row) return;
      setFeedback('');
      try {
        const res = await fetch('/api/attendance/sheet', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            athleteId,
            status: patch.status ?? row.status ?? 'PRESENT',
            rpe: patch.rpe !== undefined ? patch.rpe : row.rpe,
            durationMinutes: patch.durationMinutes !== undefined ? patch.durationMinutes : row.durationMinutes,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setFeedback('✓ 已保存');
          fetchSheet(date, { silent: true });
        } else {
          setFeedback(json.error?.message || '保存失败');
        }
      } catch {
        setFeedback('网络错误');
      }
    });
    pendingSavesRef.current.set(
      athleteId,
      task.catch(() => undefined)
    );
    await task;
    window.setTimeout(() => setFeedback(''), 2500);
  };

  const resetStatus = async (athleteId: number) => {
    setFeedback('');
    try {
      const res = await fetch(`/api/attendance/sheet?date=${date}&athleteId=${athleteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setFeedback('✓ 已重置为未标记');
        fetchSheet(date, { silent: true });
      } else {
        setFeedback(json.error?.message || '重置失败');
      }
    } catch {
      setFeedback('网络错误');
    }
    window.setTimeout(() => setFeedback(''), 2500);
  };

  const addAthlete = async () => {
    if (!addAthleteId) return;
    setFeedback('');
    try {
      const res = await fetch('/api/attendance/sheet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, athleteId: addAthleteId, status: addStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAdd(false);
        setAddAthleteId(0);
        setAddStatus('PRESENT');
        fetchSheet(date, { silent: true });
      } else {
        setFeedback(json.error?.message || '添加失败');
      }
    } catch {
      setFeedback('网络错误');
    }
  };

  const presentCount = sheet?.rows.filter((r) => r.status === 'PRESENT').length ?? 0;
  const markedCount = sheet?.rows.filter((r) => r.status).length ?? 0;

  return (
    <div className="space-y-4">
      {/* 日期导航 + 操作 */}
      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="rounded-ams border border-ams-border p-2 text-ams-text-secondary transition-colors hover:bg-ams-surface-hover"
            title="前一天"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary"
          />
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="rounded-ams border border-ams-border p-2 text-ams-text-secondary transition-colors hover:bg-ams-surface-hover"
            title="后一天"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm text-ams-text-secondary">
            {sheet ? WEEKDAYS[(sheet.dayOfWeek - 1) % 7] : ''}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-ams-text-muted">
              出勤 <span className="font-semibold text-ams-success">{presentCount}</span> · 已标记{' '}
              <span className="font-semibold text-ams-primary">{markedCount}</span> / {sheet?.rows.length ?? 0}
            </span>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <UserPlus className="h-4 w-4" />
              手动添加
            </Button>
          </div>
        </div>
        {feedback && (
          <div className="mt-3 text-sm text-ams-success">{feedback}</div>
        )}
      </div>

      {/* 手动添加弹窗 */}
      {showAdd && (
        <div className="ams-card border border-ams-primary/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ams-text-primary">手动添加参训人员</h4>
            <button onClick={() => setShowAdd(false)} className="text-ams-text-muted hover:text-ams-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <select
              value={addAthleteId}
              onChange={(e) => setAddAthleteId(parseInt(e.target.value))}
              className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value={0}>选择运动员</option>
              {(sheet?.availableAthletes ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}（{a.sport || '未登记'}）
                </option>
              ))}
            </select>
            <div>
              <span className="mb-1.5 block text-xs text-ams-text-muted">出勤状态</span>
              <StatusPicker value={addStatus} onChange={setAddStatus} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>取消</Button>
              <Button size="sm" onClick={addAthlete} disabled={!addAthleteId}>
                <Check className="h-4 w-4" />
                确认添加
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 出勤表 */}
      {isLoading ? (
        <div className="ams-card p-8 text-center text-ams-text-secondary">加载中...</div>
      ) : error ? (
        <div className="ams-card p-8 text-center text-ams-danger">{error}</div>
      ) : !sheet || sheet.rows.length === 0 ? (
        <div className="ams-card p-8 text-center text-ams-text-secondary">
          该日期暂无训练计划安排。可在上方「手动添加」额外参训人员。
        </div>
      ) : (
        <div className="ams-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="ams-table-header">
                  <th className="px-4 py-3 text-left">运动员</th>
                  <th className="px-3 py-3 text-left">来源</th>
                  <th className="px-3 py-3 text-left">出勤状态</th>
                  <th className="px-3 py-3 text-left">RPE（1-10）</th>
                  <th className="px-3 py-3 text-left">训练时长（分钟）</th>
                  <th className="px-3 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row) => (
                  <tr key={row.athleteId} className="border-t border-ams-border/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ams-primary/15 text-sm font-bold text-ams-primary">
                          {row.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-medium text-ams-text-primary">{row.name}</div>
                          <div className="text-xs text-ams-text-muted">
                            {row.sport || '未登记'}
                            {row.position ? ` · ${row.position}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {row.source === 'PLAN' ? (
                        <span className="inline-flex items-center rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                          计划 · {row.planCount} 项
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-ams-text-muted/15 px-2 py-0.5 text-xs font-medium text-ams-text-secondary">
                          手动
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPicker value={row.status} onChange={(code) => setStatus(row.athleteId, code)} />
                    </td>
                    <td className="px-3 py-3">
                      <LoadInput
                        value={row.rpe}
                        min={1}
                        max={10}
                        placeholder="1-10"
                        hint="RPE 需为 1-10 的整数"
                        disabled={!row.status}
                        onCommit={(v) => saveRow(row.athleteId, { rpe: v })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <LoadInput
                        value={row.durationMinutes}
                        min={0}
                        placeholder="分钟"
                        hint="训练时长需为非负整数（分钟）"
                        disabled={!row.status}
                        onCommit={(v) => saveRow(row.athleteId, { durationMinutes: v })}
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => resetStatus(row.athleteId)}
                        disabled={!row.status}
                        className="inline-flex items-center gap-1 rounded-ams px-2 py-1 text-xs text-ams-text-muted transition-colors hover:bg-ams-danger/10 hover:text-ams-danger disabled:opacity-40"
                        title="重置为未标记"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        重置
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 出勤报告
// ============================================================

function StatusLegend({ counts, showPercentage }: { counts: StatusCount[]; showPercentage?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {counts.map((s) => (
        <div key={s.status} className="flex items-center text-xs">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
          <span className="ml-2 text-ams-text-secondary">{s.label}</span>
          <span className="ml-12 font-semibold text-ams-text-primary">
            {showPercentage ? `${s.percentage}%` : s.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function StackedBar({ counts }: { counts: StatusCount[] }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  if (total === 0) {
    return <div className="h-6 w-full rounded-full bg-ams-border" />;
  }
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-full">
      {counts.map((s) =>
        s.count > 0 ? (
          <div
            key={s.status}
            className="flex items-center justify-center text-[10px] font-semibold text-white"
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label} ${s.count} 次（${s.percentage}%）`}
          >
            {s.count}
          </div>
        ) : null
      )}
    </div>
  );
}

function ReportView() {
  const [dimension, setDimension] = useState<'individual' | 'team'>('team');
  const [athletes, setAthletes] = useState<{ id: number; name: string; sport: string }[]>([]);
  const [sports, setSports] = useState<{ sport: string; count: number }[]>([]);
  const [athleteId, setAthleteId] = useState<number>(0);
  const [sport, setSport] = useState('');
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);

  useEffect(() => {
    fetch('/api/athletes?pageSize=100')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setAthletes(j.data.athletes ?? []);
      });
  }, []);

  useEffect(() => {
    fetch('/api/attendance/sports')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setSports(j.data.sports ?? []);
      });
  }, []);

  const generate = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ dimension, startDate, endDate });
      if (dimension === 'individual') params.set('athleteId', String(athleteId));
      if (dimension === 'team' && sport) params.set('sport', sport);
      const res = await fetch(`/api/attendance/report?${params}`);
      const json = await res.json();
      if (json.success) setReport(json.data);
      else setError(json.error?.message || '生成失败');
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'word') => {
    if (!report) return;
    setExporting(format);
    try {
      const res = await fetch('/api/attendance/report/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimension,
          athleteId: dimension === 'individual' ? athleteId : undefined,
          sport: dimension === 'team' ? sport || undefined : undefined,
          startDate,
          endDate,
          format,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message || '导出失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'pdf' ? `出勤报告-${Date.now()}.pdf` : `出勤报告-${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('导出失败');
    } finally {
      setExporting(null);
    }
  };

  const preset = (key: 'month' | 'year' | '30d') => {
    if (key === 'month') {
      setStartDate(firstOfMonth());
      setEndDate(todayStr());
    } else if (key === 'year') {
      setStartDate(firstOfYear());
      setEndDate(todayStr());
    } else {
      setStartDate(addDays(todayStr(), -29));
      setEndDate(todayStr());
    }
  };

  const pieData = useMemo(
    () => (report ? report.statusCounts.map((s) => ({ name: s.label, value: s.count, color: s.color })) : []),
    [report]
  );
  const hasData = pieData.some((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* 报告条件 */}
      <div className="ams-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 维度切换 */}
          <div>
            <span className="mb-1.5 block text-xs text-ams-text-muted">报告维度</span>
            <div className="flex gap-1 rounded-ams bg-ams-surface p-1">
              {(['team', 'individual'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDimension(d);
                    setReport(null);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-ams px-3 py-1.5 text-sm font-medium transition-colors',
                    dimension === d
                      ? 'bg-ams-primary text-white'
                      : 'text-ams-text-secondary hover:text-ams-text-primary'
                  )}
                >
                  {d === 'team' ? <Users className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                  {d === 'team' ? '团队' : '个人'}
                </button>
              ))}
            </div>
          </div>

          {dimension === 'individual' && (
            <div>
              <span className="mb-1.5 block text-xs text-ams-text-muted">运动员</span>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(parseInt(e.target.value))}
                className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary"
              >
                <option value={0}>选择运动员</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.sport || '未登记'}）
                  </option>
                ))}
              </select>
            </div>
          )}

          {dimension === 'team' && (
            <div>
              <span className="mb-1.5 block text-xs text-ams-text-muted">运动项目</span>
              <select
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value);
                  setReport(null);
                }}
                className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary"
              >
                <option value="">全部项目</option>
                {sports.map((s) => (
                  <option key={s.sport} value={s.sport}>
                    {s.sport}（{s.count}人）
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-xs text-ams-text-muted">开始日期</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-ams-text-muted">结束日期</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              className="rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => preset('month')}>本月</Button>
            <Button variant="outline" size="sm" onClick={() => preset('year')}>本年</Button>
            <Button variant="outline" size="sm" onClick={() => preset('30d')}>近30天</Button>
          </div>

          <Button
            onClick={generate}
            disabled={dimension === 'individual' && !athleteId}
          >
            <FileBarChart className="h-4 w-4" />
            生成报告
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="ams-card p-8 text-center text-ams-text-secondary">正在生成报告...</div>
      )}
      {error && <div className="ams-card p-4 text-center text-ams-danger">{error}</div>}

      {report && !isLoading && (
        <div className="space-y-4">
          {/* 概览 + 饼图 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-ams border border-ams-border bg-ams-surface px-3 py-2.5 text-center">
                  <div className="text-xs text-ams-text-muted">计划总数</div>
                  <div className="mt-1 text-xl font-bold text-ams-text-primary">
                    {report.dimension === 'individual' ? report.totalPlans : report.planCount}
                  </div>
                </div>
                {report.dimension === 'team' ? (
                  <>
                    <div className="rounded-ams border border-ams-border bg-ams-surface px-3 py-2.5 text-center">
                      <div className="text-xs text-ams-text-muted">总人数</div>
                      <div className="mt-1 text-xl font-bold text-ams-primary">{report.members.length}</div>
                    </div>
                    <div className="rounded-ams border border-ams-border bg-ams-surface px-3 py-2.5 text-center">
                      <div className="text-xs text-ams-text-muted">周期长度</div>
                      <div className="mt-1 text-xl font-bold text-ams-text-muted">
                        {daysBetween(report.range.startDate, report.range.endDate)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-ams border border-ams-border bg-ams-surface px-3 py-2.5 text-center">
                      <div className="text-xs text-ams-text-muted">训练天数</div>
                      <div className="mt-1 text-xl font-bold text-ams-primary">{report.planCount}</div>
                    </div>
                    <div className="rounded-ams border border-ams-border bg-ams-surface px-3 py-2.5 text-center">
                      <div className="text-xs text-ams-text-muted">周期长度</div>
                      <div className="mt-1 text-xl font-bold text-ams-text-muted">
                        {daysBetween(report.range.startDate, report.range.endDate)}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-ams border border-ams-border bg-ams-surface p-4">
                <h4 className="mb-2 text-sm font-semibold text-ams-text-primary">状态占比图例</h4>
                <StatusLegend counts={report.statusCounts} />
              </div>
            </div>

            <div className="rounded-ams border border-ams-border bg-ams-surface p-4 lg:col-span-2">
              <h4 className="mb-2 text-sm font-semibold text-ams-text-primary">出勤状态占比</h4>
              {hasData ? (
                <div className="flex items-center gap-6">
                  <div className="h-[220px] w-[220px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={90}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {pieData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#132F4C',
                            border: '1px solid #1E3A5F',
                            borderRadius: 8,
                            color: '#E6EDF3',
                          }}
                          formatter={(value: number, name: string) => [`${value} 次`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1">
                    <StatusLegend counts={report.statusCounts} showPercentage />
                  </div>
                </div>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-ams-text-muted">
                  该时间段内暂无出勤记录
                </div>
              )}
            </div>
          </div>

          {/* 个人：日程标注 */}
          {report.dimension === 'individual' && (
            <div className="rounded-ams border border-ams-border bg-ams-surface p-4">
              <h4 className="mb-3 text-sm font-semibold text-ams-text-primary">日程标注</h4>
              <ScheduleGrid schedule={report.schedule} />
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                {ATTENDANCE_STATUSES.map((s) => (
                  <span key={s.code} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#3A4A5F]" />
                  未标记
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-ams-border" />
                  无计划
                </span>
              </div>
            </div>
          )}

          {/* 团队：人员明细 */}
          {report.dimension === 'team' && (
            <div className="rounded-ams border border-ams-border bg-ams-surface p-4">
              <h4 className="mb-3 text-sm font-semibold text-ams-text-primary">人员明细</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="ams-table-header">
                      <th className="w-28 px-3 py-2 text-left">姓名</th>
                      <th className="w-16 px-3 py-2 text-right">计划</th>
                      <th className="px-3 py-2 text-center">出勤状态占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.members.map((m) => (
                      <tr key={m.athleteId} className="border-t border-ams-border/50">
                        <td className="px-3 py-2.5 font-medium text-ams-text-primary">{m.name}</td>
                        <td className="px-3 py-2.5 text-right text-ams-text-primary">{m.planCount}</td>
                        <td className="px-3 py-2.5">
                          <div className="min-w-[240px]">
                            <StackedBar counts={m.statusCounts} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 导出 */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportReport('pdf')} disabled={exporting !== null}>
              <Download className="h-4 w-4" />
              {exporting === 'pdf' ? '导出中...' : '导出 PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('word')} disabled={exporting !== null}>
              <Download className="h-4 w-4" />
              {exporting === 'word' ? '导出中...' : '导出 Word'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleGrid({ schedule }: { schedule: ScheduleCell[] }) {
  const short = ['一', '二', '三', '四', '五', '六', '日'];
  const totalWeeks = Math.ceil(schedule.length / 7);
  const maxVisibleWeeks = 8;
  // 单次最多显示 8 周：8 行（每行 h-11 = 2.75rem）+ 7 个行间距（gap-1.5 = 0.375rem）
  const maxVisibleHeight = `${maxVisibleWeeks * 2.75 + (maxVisibleWeeks - 1) * 0.375}rem`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {short.map((w) => (
          <div key={w} className="rounded bg-ams-surface-hover py-1 text-center text-xs font-medium text-ams-text-secondary">
            周{w}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1.5 overflow-y-auto overscroll-contain"
        style={{ maxHeight: maxVisibleHeight }}
      >
        {schedule.map((cell) => {
          const month = parseInt(cell.date.slice(5, 7), 10);
          const day = parseInt(cell.date.slice(8, 10), 10);
          const hasStatus = cell.scheduled && !!cell.status;
          const statusLabel = hasStatus ? getAttendanceStatusLabel(cell.status) : null;
          const statusColor = hasStatus ? getAttendanceStatusColor(cell.status) : undefined;

          let bg = 'bg-ams-border';
          let text = 'text-ams-text-muted';
          if (cell.scheduled && !cell.status) {
            bg = 'bg-[#3A4A5F]';
            text = 'text-white';
          } else if (hasStatus) {
            bg = '';
            text = 'text-white';
          }

          return (
            <div
              key={cell.date}
              className={cn('flex h-11 flex-col items-center justify-center gap-0.5 rounded-ams px-1', bg, text)}
              style={statusColor ? { backgroundColor: statusColor } : undefined}
              title={`${cell.date} · ${cell.scheduled ? (statusLabel ?? '未标记') : '无计划'}`}
            >
              <span className="text-[10px] font-semibold leading-none">
                {month}月{day}日
              </span>
              {statusLabel && <span className="text-[9px] leading-none">{statusLabel}</span>}
            </div>
          );
        })}
      </div>
      {totalWeeks > maxVisibleWeeks && (
        <div className="text-right text-xs text-ams-text-muted">
          共 {totalWeeks} 周，单次显示 {maxVisibleWeeks} 周，拖动右侧滚动条查看其余出勤记录
        </div>
      )}
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function AttendanceView() {
  const [tab, setTab] = useState<'sheet' | 'report'>('sheet');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-ams bg-ams-surface p-1">
        <button
          onClick={() => setTab('sheet')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-ams px-4 py-2 text-sm font-medium transition-colors',
            tab === 'sheet' ? 'bg-ams-primary text-white' : 'text-ams-text-secondary hover:text-ams-text-primary'
          )}
        >
          <ClipboardCheck className="h-4 w-4" />
          出勤表
        </button>
        <button
          onClick={() => setTab('report')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-ams px-4 py-2 text-sm font-medium transition-colors',
            tab === 'report' ? 'bg-ams-primary text-white' : 'text-ams-text-secondary hover:text-ams-text-primary'
          )}
        >
          <FileBarChart className="h-4 w-4" />
          出勤报告
        </button>
      </div>

      {tab === 'sheet' ? <SheetView /> : <ReportView />}
    </div>
  );
}
