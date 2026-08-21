'use client';

/**
 * 测试成绩录入 —— /fitness-test/results
 *
 * 对已执行测试计划进行成绩录入与管理：
 * - 仅状态为「已执行」的测试计划可进入成绩录入
 * - 矩阵批量录入：行=参与人员，列=测试项目，单元格按成绩类型动态渲染
 * - 支持「保存全部」（批量）与「保存此运动员」（单个）两种模式
 * - 已录入成绩回显，可直接修改后重新保存（upsert）
 * - 本地即时校验 + 后端兜底校验
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  Save,
  AlertCircle,
  UserRound,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanOption {
  id: number;
  name: string;
  testDate: string;
  startTime: string | null;
  status: string;
}

interface ResultItem {
  testId: number;
  name: string;
  unit: string;
  direction: string;
  resultType: string;
  gradeOptions: string[] | null;
}

interface ResultAthlete {
  id: number;
  name: string;
}

interface SavedResult {
  athleteId: number;
  testId: number;
  rawValue: string | null;
}

interface ResultsData {
  plan: {
    id: number;
    name: string;
    testDate: string;
    startTime: string | null;
    status: string;
  };
  participants: ResultAthlete[];
  items: ResultItem[];
  results: SavedResult[];
}

const RESULT_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  NUMERIC: { label: '数值', className: 'bg-ams-success/10 text-ams-success' },
  GRADE: { label: '等级', className: 'bg-ams-warning/10 text-ams-warning' },
  DESCRIPTIVE: { label: '描述', className: 'bg-ams-primary/10 text-ams-primary' },
};

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

function cellKey(athleteId: number, testId: number) {
  return `${athleteId}_${testId}`;
}

function ResultsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPlanId = searchParams.get('planId');

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState<number | null>(
    urlPlanId ? parseInt(urlPlanId, 10) || null : null
  );
  const [data, setData] = useState<ResultsData | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载可录入成绩的计划（仅已执行）
  useEffect(() => {
    let cancelled = false;
    fetch('/api/fitness/plans?status=COMPLETED&page=1&pageSize=100')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success && Array.isArray(j.data?.plans)) {
          setPlans(j.data.plans);
          // URL 携带 planId 但不在已执行列表中时保持为空，避免误入
          setPlanId((prev) => {
            if (prev !== null && j.data.plans.some((p: PlanOption) => p.id === prev)) return prev;
            return null;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setMessage({ type: 'error', text: '加载测试计划失败，请稍后重试' });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlans(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载选中计划的成绩矩阵
  useEffect(() => {
    if (planId === null) {
      setData(null);
      setValues({});
      setValidationErrors({});
      return;
    }
    let cancelled = false;
    setIsLoadingData(true);
    setMessage(null);
    fetch(`/api/fitness/plans/${planId}/results`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) {
          setData(j.data);
          const init: Record<string, string> = {};
          for (const p of j.data.participants) {
            for (const it of j.data.items) {
              init[cellKey(p.id, it.testId)] = '';
            }
          }
          for (const r of j.data.results) {
            init[cellKey(r.athleteId, r.testId)] = r.rawValue ?? '';
          }
          setValues(init);
          setValidationErrors({});
        } else {
          setMessage({ type: 'error', text: j.error?.message || '加载成绩数据失败' });
        }
      })
      .catch(() => {
        if (!cancelled) setMessage({ type: 'error', text: '网络异常，加载成绩数据失败' });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const testMeta = useMemo(() => {
    const m = new Map<number, ResultItem>();
    for (const it of data?.items ?? []) m.set(it.testId, it);
    return m;
  }, [data]);

  const handleValueChange = (athleteId: number, testId: number, v: string) => {
    setValues((prev) => ({ ...prev, [cellKey(athleteId, testId)]: v }));
    // 清除该格的旧校验错误
    setValidationErrors((prev) => {
      if (!prev[cellKey(athleteId, testId)]) return prev;
      const next = { ...prev };
      delete next[cellKey(athleteId, testId)];
      return next;
    });
  };

  /** 构建提交行；filterAthleteId 传入时仅提交该运动员（单个模式） */
  const buildRows = useCallback(
    (filterAthleteId?: number) => {
      if (!data) return [];
      const rows: { athleteId: number; testId: number; value: string | null }[] = [];
      for (const p of data.participants) {
        if (filterAthleteId !== undefined && p.id !== filterAthleteId) continue;
        for (const it of data.items) {
          const raw = (values[cellKey(p.id, it.testId)] ?? '').trim();
          rows.push({ athleteId: p.id, testId: it.testId, value: raw === '' ? null : raw });
        }
      }
      return rows;
    },
    [data, values]
  );

  /** 本地即时校验：与后端校验规则一致，返回错误 map */
  const validateRows = useCallback(
    (rows: { athleteId: number; testId: number; value: string | null }[]) => {
      const errs: Record<string, string> = {};
      for (const r of rows) {
        if (!r.value) continue;
        const meta = testMeta.get(r.testId);
        if (!meta) continue;
        if (meta.resultType === 'NUMERIC' && !NUMERIC_PATTERN.test(r.value)) {
          errs[cellKey(r.athleteId, r.testId)] = '请输入有效数字';
        } else if (meta.resultType === 'DESCRIPTIVE' && r.value.length > 500) {
          errs[cellKey(r.athleteId, r.testId)] = '描述不能超过500个字符';
        }
      }
      return errs;
    },
    [testMeta]
  );

  const handleSave = async (filterAthleteId?: number) => {
    if (!data || planId === null) return;
    const rows = buildRows(filterAthleteId);
    const errs = validateRows(rows);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      setMessage({ type: 'error', text: '存在格式不正确的成绩，请修正后重试' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/fitness/plans/${planId}/results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: rows }),
      });
      const json = await res.json();
      if (json.success) {
        const r = json.data;
        setMessage({
          type: 'success',
          text:
            r.saved > 0
              ? `保存成功：录入 ${r.saved} 条成绩${r.cleared > 0 ? `，清空 ${r.cleared} 条` : ''}`
              : '保存成功',
        });
        // 刷新回显
        const refresh = await fetch(`/api/fitness/plans/${planId}/results`);
        const refreshJson = await refresh.json();
        if (refreshJson.success) {
          const init: Record<string, string> = {};
          for (const p of refreshJson.data.participants) {
            for (const it of refreshJson.data.items) init[cellKey(p.id, it.testId)] = '';
          }
          for (const r2 of refreshJson.data.results) {
            init[cellKey(r2.athleteId, r2.testId)] = r2.rawValue ?? '';
          }
          setValues(init);
          // 同步已录成绩列表，顶部「已录 N 条成绩」计数即时刷新
          setData((prev) => (prev ? { ...prev, results: refreshJson.data.results } : prev));
        }
      } else {
        setMessage({ type: 'error', text: json.error?.message || '保存失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '网络异常，保存失败' });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 返回上级：成绩录入的上一级固定为「体能测试管理」首页。
   * 使用 router.replace 直接导航到父级页面并替换当前历史条目，
   * 避免 router.back() 受浏览器会话历史影响回退到兄弟页面形成导航循环。
   */
  const handleBack = () => {
    router.replace('/fitness-test');
  };

  const hasAnyValue = Object.values(values).some((v) => v.trim() !== '');
  const savedCount = data ? data.results.length : 0;

  return (
    <div className="space-y-4">
      {/* 顶部工具条（sticky 固定） */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-ams-background/95 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="返回上一级"
            title="返回上一级"
            className="inline-flex items-center gap-1.5 rounded-ams px-2.5 py-1.5 text-sm font-medium text-ams-text-secondary transition-all duration-150 hover:scale-[1.04] hover:bg-ams-surface-hover hover:text-ams-text-primary active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </button>
          <h2 className="text-xl font-semibold text-ams-text-primary">测试成绩录入</h2>
        </div>
        {planId !== null && (
          <Button size="sm" onClick={() => handleSave()} disabled={isSaving || !hasAnyValue}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存全部成绩
          </Button>
        )}
      </div>

      {/* 计划选择 */}
      <div className="ams-card p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="plan-select" className="text-sm font-medium text-ams-text-primary">
            选择测试计划（仅已执行的计划可录入成绩）
          </label>
          <div className="relative max-w-md">
            <select
              id="plan-select"
              value={planId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setPlanId(v ? parseInt(v, 10) : null);
              }}
              className="w-full appearance-none rounded-ams bg-ams-background border border-ams-border px-3 py-2 pr-9 text-sm text-ams-text-primary focus:outline-none focus:border-ams-primary"
            >
              <option value="">请选择测试计划</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{new Date(p.testDate).toLocaleDateString('zh-CN')}
                  {p.startTime ? ` ${p.startTime}` : ''}）
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
          </div>
          {!isLoadingPlans && plans.length === 0 && (
            <p className="text-xs text-ams-text-muted">暂无已执行的测试计划，计划执行完成后即可录入成绩</p>
          )}
        </div>
      </div>

      {/* 提示消息 */}
      {message && (
        <div
          className={`flex items-start gap-2 rounded-ams px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-ams-success/10 text-ams-success'
              : 'bg-ams-danger/10 text-ams-danger'
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 成绩矩阵 */}
      {planId !== null && (
        <div className="ams-card overflow-hidden">
          {isLoadingData ? (
            <div className="p-10 text-center text-ams-text-secondary text-sm">加载中...</div>
          ) : data ? (
            <>
              {/* 计划信息头 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ams-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-ams-text-primary">{data.plan.name}</div>
                  <div className="text-xs text-ams-text-muted">
                    {new Date(data.plan.testDate).toLocaleDateString('zh-CN')}
                    {data.plan.startTime ? ` ${data.plan.startTime}` : ''} · 已录 {savedCount} 条成绩
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ams-border bg-ams-surface/60">
                      <th className="sticky left-0 z-10 min-w-[120px] bg-ams-surface/90 px-4 py-3 text-left ams-table-header">
                        运动员
                      </th>
                      {data.items.map((it) => {
                        const t = RESULT_TYPE_LABELS[it.resultType] || RESULT_TYPE_LABELS.NUMERIC;
                        return (
                          <th key={it.testId} className="min-w-[140px] px-3 py-3 text-left ams-table-header">
                            <div className="font-medium">{it.name}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${t.className}`}>
                                {t.label}
                              </span>
                              {it.resultType === 'NUMERIC' && (
                                <span className="text-[10px] text-ams-text-muted">{it.unit}</span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      <th className="sticky right-0 z-10 min-w-[120px] bg-ams-surface/90 px-3 py-3 text-right ams-table-header">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.participants.map((ath) => (
                      <tr
                        key={ath.id}
                        className="border-b border-ams-border/50 transition-colors hover:bg-ams-primary/5"
                      >
                        <td className="sticky left-0 z-10 bg-ams-background px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-ams-text-primary font-medium">
                            <UserRound className="h-4 w-4 text-ams-text-muted" />
                            {ath.name}
                          </span>
                        </td>
                        {data.items.map((it) => {
                          const key = cellKey(ath.id, it.testId);
                          const err = validationErrors[key];
                          const v = values[key] ?? '';
                          return (
                            <td key={it.testId} className="px-3 py-2">
                              {it.resultType === 'GRADE' ? (
                                <select
                                  value={v}
                                  onChange={(e) => handleValueChange(ath.id, it.testId, e.target.value)}
                                  aria-label={`${ath.name} ${it.name} 成绩`}
                                  className={`w-full rounded-ams bg-ams-background border px-2 py-1.5 text-sm text-ams-text-primary focus:outline-none focus:border-ams-primary ${
                                    err ? 'border-ams-danger' : 'border-ams-border'
                                  }`}
                                >
                                  <option value="">--</option>
                                  {(it.gradeOptions ?? []).map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : it.resultType === 'DESCRIPTIVE' ? (
                                <input
                                  type="text"
                                  value={v}
                                  maxLength={500}
                                  onChange={(e) => handleValueChange(ath.id, it.testId, e.target.value)}
                                  aria-label={`${ath.name} ${it.name} 成绩`}
                                  placeholder="填写描述"
                                  className={`w-full rounded-ams bg-ams-background border px-2 py-1.5 text-sm text-ams-text-primary focus:outline-none focus:border-ams-primary ${
                                    err ? 'border-ams-danger' : 'border-ams-border'
                                  }`}
                                />
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={v}
                                    min={0}
                                    step="any"
                                    onChange={(e) => handleValueChange(ath.id, it.testId, e.target.value)}
                                    aria-label={`${ath.name} ${it.name} 成绩`}
                                    placeholder="填写数值"
                                    className={`w-full rounded-ams bg-ams-background border px-2 py-1.5 text-sm text-ams-text-primary focus:outline-none focus:border-ams-primary ${
                                      err ? 'border-ams-danger' : 'border-ams-border'
                                    }`}
                                  />
                                  <span className="shrink-0 text-xs text-ams-text-muted">{it.unit}</span>
                                </div>
                              )}
                              {err && <div className="mt-1 text-xs text-ams-danger">{err}</div>}
                            </td>
                          );
                        })}
                        <td className="sticky right-0 z-10 bg-ams-background px-3 py-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSaving}
                            onClick={() => handleSave(ath.id)}
                          >
                            保存此运动员
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ams-border px-4 py-3">
                <div className="text-xs text-ams-text-muted">
                  {data.participants.length} 名运动员 × {data.items.length} 个测试项目 · 空单元格表示未录入
                </div>
                <Button onClick={() => handleSave()} disabled={isSaving || !hasAnyValue}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存全部成绩
                </Button>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-ams-text-muted text-sm">暂无数据</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FitnessTestResultsPage() {
  return (
    <Suspense>
      <ResultsPageContent />
    </Suspense>
  );
}
