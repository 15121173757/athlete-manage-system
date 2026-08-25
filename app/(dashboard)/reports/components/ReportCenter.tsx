'use client';

/**
 * 报告中心主组件 —— 报告中心（AMS）
 *
 * 职责：串联三类报告（训练 / 测试 / 伤病）的筛选、查询、渲染与导出。
 * 采用「统一聚合结果 + 指标 keys 过滤」架构：
 * - 查询 API 返回完整 ReportData 与生效指标 keys
 * - 前端用 filterReportData 按 keys 过滤后渲染，实现指标自定义选择
 * - 图表 / 表格 / KPI 由 ReportBlocks 原子组件渲染（模块化、可扩展）
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Dumbbell,
  ClipboardList,
  HeartPulse,
  Settings2,
  Download,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/auth-store';
import { hasPermission, Permissions } from '@/types';
import type { MetricDefinition, ReportData, ReportScope, ReportType } from '@/lib/modules/reports/types';
import { REPORT_TYPE_LABELS, REPORT_SCOPE_LABELS } from '@/lib/modules/reports/types';
import { filterReportData } from '@/lib/modules/reports/reportData';
import { KpiGrid, ChartBlockView, TableBlockView } from './ReportBlocks';
import MetricConfigPanel, { type ReportTemplateDTO } from './MetricConfigPanel';

interface AthleteOption { id: number; name: string; }
interface ExerciseOption { id: number; name: string; category: string; unit: string; }
interface TestOption { id: number; name: string; category: string; unit: string; }

interface Filters {
  athleteIds: number[];
  exerciseId: string;
  testId: string;
  status: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: Filters = {
  athleteIds: [],
  exerciseId: '',
  testId: '',
  status: '',
  startDate: '',
  endDate: '',
};

const TABS: Array<{ key: ReportType; icon: typeof Dumbbell }> = [
  { key: 'training', icon: Dumbbell },
  { key: 'fitness', icon: ClipboardList },
  { key: 'injury', icon: HeartPulse },
];

const INJURY_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'INJURED', label: '受伤' },
  { value: 'RECOVERING', label: '康复中' },
  { value: 'RETURNED', label: '已痊愈' },
];

export default function ReportCenter() {
  const user = useAuthStore((s) => s.user);

  const [reportType, setReportType] = useState<ReportType>('training');
  const [scope, setScope] = useState<ReportScope>('TEAM');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [report, setReport] = useState<ReportData | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [templates, setTemplates] = useState<ReportTemplateDTO[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 筛选选项
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);

  const canManageGlobal = user ? hasPermission(user.role, Permissions.USER_MANAGE) : false;

  // 加载筛选选项（一次性）
  useEffect(() => {
    fetch('/api/athletes?pageSize=1000')
      .then((r) => r.json())
      .then((j) => { if (j.success) setAthletes(j.data.athletes ?? []); })
      .catch(() => {});
    fetch('/api/exercises?pageSize=1000')
      .then((r) => r.json())
      .then((j) => { if (j.success) setExercises(j.data.exercises ?? []); })
      .catch(() => {});
    fetch('/api/fitness/tests')
      .then((r) => r.json())
      .then((j) => { if (j.success) setTests(j.data ?? []); })
      .catch(() => {});
  }, []);

  // 报告类型变化：加载指标定义与模板（指标 keys 由查询接口统一返回）
  useEffect(() => {
    let cancelled = false;
    setMetrics([]);
    setTemplates([]);

    fetch(`/api/reports/metrics?reportType=${reportType}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setMetrics(j.data.metrics ?? []);
      })
      .catch(() => {});

    fetch(`/api/reports/templates?reportType=${reportType}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setTemplates(j.data ?? []);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [reportType]);

  // 前端参数校验（与后端 validateReportQuery 保持一致），返回错误提示或 null
  const validateFilters = useCallback((): string | null => {
    if (!filters.startDate || !filters.endDate) {
      return '请选择报告时间范围（起始时间与结束时间）';
    }
    if (scope === 'PERSONAL' && filters.athleteIds.length !== 1) {
      return '个人报告需且仅需选择 1 名运动员';
    }
    if (scope === 'TEAM' && filters.athleteIds.length < 2) {
      return '团队报告需至少选择 2 名运动员';
    }
    return null;
  }, [filters.startDate, filters.endDate, filters.athleteIds, scope]);

  // 查询报告（报告类型 / 筛选条件变化）
  const fetchReport = useCallback(async () => {
    const invalid = validateFilters();
    if (invalid) {
      setError(invalid);
      setReport(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ reportType, scope });
      if (filters.athleteIds.length) params.set('athleteIds', filters.athleteIds.join(','));
      if (filters.exerciseId) params.set('exerciseId', filters.exerciseId);
      if (filters.testId) params.set('testId', filters.testId);
      if (filters.status) params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const res = await fetch(`/api/reports/query?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || `请求失败（${res.status}）`);
      }
      setReport(json.data.report);
      // 仅在指标尚未确定时同步服务端解析的 keys，避免覆盖用户临时应用的配置
      setKeys((prev) => (prev.length === 0 ? json.data.keys ?? [] : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载报告失败');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [reportType, scope, filters, validateFilters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // 切换报告类型
  const handleTabChange = (type: ReportType) => {
    setReportType(type);
    setScope('TEAM'); // 切换类型后默认团队报告（伤病报告仅团队）
    setFilters(EMPTY_FILTERS);
    setReport(null);
    setError(null);
  };

  // 切换报告作用域（个人 / 团队），清空已选运动员
  const handleScopeChange = (next: ReportScope) => {
    setScope(next);
    setFilters((f) => ({ ...f, athleteIds: [] }));
    setReport(null);
    setError(null);
  };

  // 按已选指标 keys 过滤报告数据
  const filtered = useMemo(
    () => (report ? filterReportData(report, keys) : null),
    [report, keys]
  );

  // 构建导出 / 查询所用的筛选对象
  const buildQuery = useCallback(() => {
    const toInt = (v: string) => (v === '' ? undefined : parseInt(v));
    return {
      scope,
      athleteIds: filters.athleteIds,
      exerciseId: toInt(filters.exerciseId),
      testId: toInt(filters.testId),
      status: filters.status || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    };
  }, [filters, scope]);

  // 导出 PDF
  const handleExport = async () => {
    const invalid = validateFilters();
    if (invalid) {
      setError(invalid);
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, filters: buildQuery(), keys }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || json?.error?.message || '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${REPORT_TYPE_LABELS[reportType]}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  // 保存模板
  const handleSaveTemplate = useCallback(
    async (name: string, templateKeys: string[], scope: 'PERSONAL' | 'GLOBAL', isDefault: boolean) => {
      const res = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          name,
          scope,
          config: { keys: templateKeys },
          isDefault,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || '保存失败');
      }
      // 刷新模板列表
      const listRes = await fetch(`/api/reports/templates?reportType=${reportType}`);
      const listJson = await listRes.json();
      if (listJson.success) setTemplates(listJson.data ?? []);
    },
    [reportType]
  );

  // 删除模板
  const handleDeleteTemplate = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/reports/templates/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || '删除失败');
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    []
  );

  // 应用指标配置
  const handleApplyKeys = (newKeys: string[]) => {
    setKeys(newKeys);
  };

  const hasAnyBlock =
    filtered &&
    (filtered.kpis.length > 0 || filtered.charts.length > 0 || filtered.tables.length > 0);

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-ams-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-ams-text-primary">报告中心</h1>
            <p className="text-xs text-ams-text-muted">
              训练 / 测试 / 伤病报告的统一查询、可视化与导出
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            <Settings2 className="h-4 w-4" />
            指标配置
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isExporting || !report}
          >
            <Download className="h-4 w-4" />
            {isExporting ? '导出中...' : '导出 PDF'}
          </Button>
        </div>
      </div>

      {/* 报告类型 Tab */}
      <div className="flex gap-1 p-1 bg-ams-surface border border-ams-border rounded-ams">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-ams text-sm font-medium transition-colors ${
              reportType === tab.key
                ? 'bg-ams-primary text-white shadow-sm'
                : 'text-ams-text-secondary hover:text-ams-text-primary hover:bg-ams-surface-hover'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {REPORT_TYPE_LABELS[tab.key]}
          </button>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ams-text-muted">
            <Filter className="h-3.5 w-3.5" />
            筛选
          </div>

          {/* 报告作用域切换（伤病报告仅团队） */}
          <div className="flex gap-1 p-1 rounded-ams border border-ams-border bg-ams-background">
            {(['PERSONAL', 'TEAM'] as ReportScope[]).map((s) => {
              const disabled = reportType === 'injury' && s === 'PERSONAL';
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleScopeChange(s)}
                  className={`px-3 py-1.5 text-sm rounded-ams transition-colors ${
                    disabled
                      ? 'cursor-not-allowed text-ams-text-muted opacity-50'
                      : scope === s
                        ? 'bg-ams-primary text-white shadow-sm'
                        : 'text-ams-text-secondary hover:text-ams-text-primary'
                  }`}
                  title={disabled ? '伤病报告仅支持团队报告' : undefined}
                >
                  {REPORT_SCOPE_LABELS[s]}
                </button>
              );
            })}
          </div>

          {/* 运动员选择：个人单选 / 团队多选 */}
          {scope === 'PERSONAL' ? (
            <select
              value={filters.athleteIds[0]?.toString() ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  athleteIds: e.target.value ? [Number(e.target.value)] : [],
                }))
              }
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">请选择 1 名运动员</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
              <select
                multiple
                size={1}
                value={filters.athleteIds.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value));
                  setFilters((f) => ({ ...f, athleteIds: selected }));
                }}
                className="min-w-[180px] rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <span className="text-xs text-ams-text-muted">
                按住 Ctrl/⌘ 多选（至少 2 名）
              </span>
            </div>
          )}

          {reportType === 'training' && (
            <select
              value={filters.exerciseId}
              onChange={(e) => setFilters((f) => ({ ...f, exerciseId: e.target.value }))}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">全部训练项目</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}

          {reportType === 'fitness' && (
            <select
              value={filters.testId}
              onChange={(e) => setFilters((f) => ({ ...f, testId: e.target.value }))}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">全部测试项目</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {reportType === 'injury' && (
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              {INJURY_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            />
            <span className="text-xs text-ams-text-muted">至</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            <RefreshCw className="h-4 w-4" />
            重置
          </Button>
        </div>
      </div>

      {/* 报告内容 */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="ams-card flex h-64 flex-col items-center justify-center text-ams-text-secondary">
            <p>正在生成报告...</p>
            <p className="mt-1 text-xs text-ams-text-muted">正在聚合 {REPORT_TYPE_LABELS[reportType]} 数据</p>
          </div>
        ) : error ? (
          <div className="ams-card flex h-64 flex-col items-center justify-center p-8 text-center">
            <p className="font-medium text-ams-danger">加载失败</p>
            <p className="mt-1 text-sm text-ams-text-secondary">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchReport}>
              重试
            </Button>
          </div>
        ) : !hasAnyBlock ? (
          <div className="ams-card flex h-64 flex-col items-center justify-center p-8 text-center">
            <FileText className="mb-2 h-8 w-8 text-ams-text-secondary opacity-40" />
            {keys.length === 0 ? (
              <p className="text-sm text-ams-text-secondary">未选择任何指标，请点击「指标配置」选择要展示的指标</p>
            ) : (
              <p className="text-sm text-ams-text-secondary">当前筛选条件下暂无数据</p>
            )}
          </div>
        ) : (
          <div className={`space-y-4 transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            {/* 报告元信息 */}
            {report && (
              <div className="flex items-center justify-between text-xs text-ams-text-muted">
                <span>
                  {REPORT_SCOPE_LABELS[report.scope] ?? ''}
                  {report.athletes.length > 0 && ` · ${report.athletes.join('、')}`}
                </span>
                <span>
                  生成时间：{new Date(report.generatedAt).toLocaleString('zh-CN')} · 展示指标：{keys.length} 项
                </span>
              </div>
            )}

            {filtered.kpis.length > 0 && <KpiGrid kpis={filtered.kpis} />}

            {filtered.charts.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {filtered.charts.map((chart) => (
                  <ChartBlockView key={chart.key} chart={chart} />
                ))}
              </div>
            )}

            {filtered.tables.length > 0 && (
              <div className="space-y-4">
                {filtered.tables.map((table) => (
                  <TableBlockView key={table.key} table={table} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 指标配置面板 */}
      {showConfig && (
        <MetricConfigPanel
          reportType={reportType}
          metrics={metrics}
          selectedKeys={keys}
          templates={templates}
          canManageGlobal={canManageGlobal}
          onApply={handleApplyKeys}
          onSaveTemplate={handleSaveTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
