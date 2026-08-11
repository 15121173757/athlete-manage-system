'use client';

/**
 * 1RM（最大重复次数）预测工具
 * 支持传统法（重量 × 次数，6 个循证公式综合）与速度法（VBT，速度-负荷回归外推）
 */
import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Copy,
  Download,
  Dumbbell,
  Info,
  Plus,
  Scale,
  Timer,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EXERCISE_TEMPLATES,
  buildTraditionalReport,
  buildVelocityReport,
  calculateTraditional,
  calculateVelocity,
  validateTraditionalInputs,
  validateVelocityInputs,
  type RepSet,
  type VelocityPoint,
} from '@/lib/sport-science/one-rm';

interface Athlete {
  id: number;
  name: string;
}

const inputCls =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

const tooltipStyle = {
  backgroundColor: '#132F4C',
  border: '1px solid #1E3A5F',
  borderRadius: 8,
  fontSize: 12,
  color: '#E6EDF3',
};

const axisProps = {
  tick: { fill: '#8B98A9', fontSize: 11 },
  axisLine: { stroke: '#1E3A5F' },
  tickLine: { stroke: '#1E3A5F' },
} as const;

/** 图例内容项（recharts 回调实参为超集，字段可空，取用其中字段即可） */
type LegendPayloadEntry = { value?: string | number; color?: string };

/** 自定义图例：内容自适应宽度的居中色块图例 */
const renderLegend = (props: { payload?: LegendPayloadEntry[] }) => {
  const { payload } = props;
  return (
    <ul className="mx-auto flex w-fit list-none flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-ams border border-ams-border/40 bg-ams-background/30 px-3 py-1">
      {(payload || []).map((entry) => (
        <li key={String(entry.value)} className="flex items-center gap-1.5 text-xs text-ams-text-secondary">
          <span className="inline-block h-2 w-4 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  );
};

type OneRMMethod = 'traditional' | 'velocity';

export function OneRMProfileTool() {
  // 运动员（可选，用于报告姓名）
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteName, setAthleteName] = useState('');

  // 预测方法
  const [method, setMethod] = useState<OneRMMethod>('traditional');

  // 传统法：多组（重量, 次数）
  const [tradRows, setTradRows] = useState<{ weight: string; reps: string }[]>([
    { weight: '', reps: '' },
    { weight: '', reps: '' },
  ]);
  // 速度法：多组（负荷, 平均速度）
  const [velRows, setVelRows] = useState<{ load: string; velocity: string }[]>([
    { load: '', velocity: '' },
    { load: '', velocity: '' },
    { load: '', velocity: '' },
  ]);
  const [exerciseKey, setExerciseKey] = useState('bench');
  const [customMvt, setCustomMvt] = useState('');

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/athletes?pageSize=200')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setAthletes(j.data.athletes || j.data || []);
      })
      .catch(() => {});
  }, []);

  const handleAthleteSelect = (id: string) => {
    const a = athletes.find((x) => String(x.id) === id);
    setAthleteName(a ? a.name : '');
  };

  const exercise = EXERCISE_TEMPLATES.find((t) => t.key === exerciseKey);
  const mvt = exerciseKey === 'custom' ? Number(customMvt) : (exercise?.mvt ?? 0.15);

  // 传统法输入与校验
  const tradInputs = useMemo<RepSet[]>(
    () =>
      tradRows
        .map((r) => ({ weight: Number(r.weight), reps: Number(r.reps) }))
        .filter((s) => Number.isFinite(s.weight) && s.weight > 0 && Number.isFinite(s.reps) && s.reps > 0),
    [tradRows]
  );
  const tradFilled = tradInputs.length > 0;
  const tradErrors = useMemo(() => {
    if (!tradFilled) return [] as string[];
    return validateTraditionalInputs(tradInputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradFilled, tradInputs]);

  // 速度法输入与校验
  const velInputs = useMemo<VelocityPoint[]>(
    () =>
      velRows
        .map((r) => ({ load: Number(r.load), velocity: Number(r.velocity) }))
        .filter((p) => Number.isFinite(p.load) && p.load > 0 && Number.isFinite(p.velocity) && p.velocity > 0),
    [velRows]
  );
  const velFilled = velInputs.length >= 2 && Number.isFinite(mvt) && mvt > 0;
  const velErrors = useMemo(() => {
    if (!velFilled) return [] as string[];
    return validateVelocityInputs(velInputs, mvt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [velFilled, velInputs, mvt]);

  const filled = method === 'traditional' ? tradFilled : velFilled;

  const errors = useMemo(() => {
    if (method === 'traditional') return tradErrors;
    return velErrors;
  }, [method, tradErrors, velErrors]);

  // 计算结果（含拟合/外推阶段的异常信息，如外推距离过大等）
  const computeError = useMemo(() => {
    if (!filled || errors.length > 0) return null;
    try {
      if (method === 'traditional') calculateTraditional(tradInputs);
      else calculateVelocity(velInputs, mvt);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : '计算失败，请检查输入数据';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, errors, method, tradInputs, velInputs, mvt]);

  const result = useMemo(() => {
    if (!filled || errors.length > 0 || computeError) return null;
    try {
      if (method === 'traditional') {
        return calculateTraditional(tradInputs);
      }
      return calculateVelocity(velInputs, mvt);
    } catch (e) {
      return null;
    }
  }, [filled, errors, computeError, method, tradInputs, velInputs, mvt]);

  // 展示用错误列表：输入校验错误 + 计算阶段异常
  const displayErrors = computeError ? [...errors, computeError] : errors;

  const report = useMemo(() => {
    if (!result) return '';
    if (result.method === 'traditional') {
      return buildTraditionalReport(result, athleteName || undefined);
    }
    return buildVelocityReport(result, athleteName || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, athleteName]);

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${athleteName || 'athlete'}-1RM-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ============ 左：测试设置 ============ */}
      <div className="space-y-6 lg:col-span-2">
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">运动员信息</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">选择运动员（可选）</label>
              <select
                value={athletes.find((a) => a.name === athleteName)?.id ?? ''}
                onChange={(e) => handleAthleteSelect(e.target.value)}
                className={inputCls}
              >
                <option value="">手动填写</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ams-text-muted">选中后将用于报告署名（无需体重）</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">预测方法</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('traditional')}
                  className={`rounded-ams border px-3 py-2 text-sm transition-colors ${
                    method === 'traditional'
                      ? 'border-ams-primary bg-ams-primary/10 text-ams-primary font-medium'
                      : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50'
                  }`}
                >
                  传统法（重量 × 次数）
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('velocity')}
                  className={`rounded-ams border px-3 py-2 text-sm transition-colors ${
                    method === 'velocity'
                      ? 'border-ams-primary bg-ams-primary/10 text-ams-primary font-medium'
                      : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50'
                  }`}
                >
                  速度法（VBT）
                </button>
              </div>
              <p className="mt-1 text-xs text-ams-text-muted">
                {method === 'traditional'
                  ? '由次极限负荷训练组的重量与次数，经 6 个循证经验公式综合外推 1RM'
                  : '由速度-负荷线性回归外推 1RM（需速度传感器/激光测速设备采集杠铃平均速度）'}
              </p>
            </div>
          </div>
        </section>

        {method === 'traditional' ? (
          <section className="ams-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Scale className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">训练组数据（重量 × 次数）</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-ams-text-muted">
                <span>以次极限负荷完成至力竭（或接近力竭）并记录次数</span>
                <span className="text-ams-text-secondary">至少 1 组，建议 2–3 组不同负荷</span>
              </div>
              <div className="overflow-hidden rounded-ams border border-ams-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="ams-table-header">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">重量（kg）</th>
                      <th className="px-3 py-2 text-left">次数（次）</th>
                      <th className="w-10 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {tradRows.map((r, i) => (
                      <tr key={i} className="border-t border-ams-border/50">
                        <td className="px-3 py-1.5 text-xs text-ams-text-muted">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={r.weight}
                            onChange={(e) => {
                              const next = [...tradRows];
                              next[i] = { ...next[i], weight: e.target.value };
                              setTradRows(next);
                            }}
                            placeholder="如：80"
                            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            step="1"
                            value={r.reps}
                            onChange={(e) => {
                              const next = [...tradRows];
                              next[i] = { ...next[i], reps: e.target.value };
                              setTradRows(next);
                            }}
                            placeholder="如：8"
                            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          {tradRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setTradRows(tradRows.filter((_, j) => j !== i))}
                              className="rounded p-1 text-ams-text-muted hover:text-ams-danger"
                              title="删除该组"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setTradRows([...tradRows, { weight: '', reps: '' }])}
                className="flex items-center gap-1 text-xs font-medium text-ams-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                添加数据组
              </button>
            </div>
          </section>
        ) : (
          <section className="ams-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Timer className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">速度-负荷数据</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">动作类型</label>
                <select
                  value={exerciseKey}
                  onChange={(e) => setExerciseKey(e.target.value)}
                  className={inputCls}
                >
                  {EXERCISE_TEMPLATES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                  <option value="custom">自定义（手动输入 MVT）</option>
                </select>
                <p className="mt-1 text-xs text-ams-text-muted">
                  {exerciseKey === 'custom'
                    ? '手动输入该动作的 1RM 速度阈值（MVT），单位 m/s'
                    : exercise?.desc}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                  1RM 速度阈值 MVT（m/s）
                </label>
                {exerciseKey === 'custom' ? (
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={customMvt}
                    onChange={(e) => setCustomMvt(e.target.value)}
                    placeholder="如：0.15"
                    className={inputCls}
                  />
                ) : (
                  <input type="text" value={exercise?.mvt.toFixed(2)} readOnly disabled className={inputCls} />
                )}
                <p className="mt-1 text-xs text-ams-text-muted">
                  平均速度达到该阈值时视为 1RM 负荷；文献典型值随动作而异，建议按个人实测校准
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ams-text-muted">
                  <span>不同负荷下的杠铃平均速度（m/s）</span>
                  <span className="text-ams-text-secondary">至少 2 组，建议 3–5 组</span>
                </div>
                <div className="overflow-hidden rounded-ams border border-ams-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="ams-table-header">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">负荷（kg）</th>
                        <th className="px-3 py-2 text-left">平均速度（m/s）</th>
                        <th className="w-10 px-1 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {velRows.map((r, i) => (
                        <tr key={i} className="border-t border-ams-border/50">
                          <td className="px-3 py-1.5 text-xs text-ams-text-muted">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={r.load}
                              onChange={(e) => {
                                const next = [...velRows];
                                next[i] = { ...next[i], load: e.target.value };
                                setVelRows(next);
                              }}
                              placeholder="如：60"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={r.velocity}
                              onChange={(e) => {
                                const next = [...velRows];
                                next[i] = { ...next[i], velocity: e.target.value };
                                setVelRows(next);
                              }}
                              placeholder="如：0.78"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {velRows.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setVelRows(velRows.filter((_, j) => j !== i))}
                                className="rounded p-1 text-ams-text-muted hover:text-ams-danger"
                                title="删除该组"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setVelRows([...velRows, { load: '', velocity: '' }])}
                  className="flex items-center gap-1 text-xs font-medium text-ams-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加数据点
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="ams-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">方法说明</h3>
          </div>
          {method === 'traditional' ? (
            <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-ams-text-secondary">
              <li>选择次极限负荷（通常 3–12 RM）完成一组至力竭或接近力竭，记录次数。</li>
              <li>经验公式在次数 2–12 范围内可靠性最高；次数越多估算误差越大。</li>
              <li>工具综合 6 个循证公式（Epley/Brzycki/Lander/Mayhew/O&apos;Conner/Wathan）的平均值，降低单公式系统偏差。</li>
              <li>不同负荷组的估算结果一致性（CV ≤ 5%）可反映数据可靠性。</li>
            </ul>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-ams-text-secondary">
              <li>用测速设备（线性位置传感器/激光/手机 App）采集 2–5 个不同负荷的向心平均速度（m/s）。</li>
              <li>平均速度与负荷呈强线性关系（典型 R² 可达 0.95 以上），回归外推到 MVT 对应负荷即为 1RM。</li>
              <li>数据点应覆盖较宽负荷谱系（如 50%–90% 1RM 区间），避免外推距离过大。</li>
              <li>MVT 因动作与个体而异，建议定期用实测 1RM 校准后再用于日常训练监控。</li>
            </ul>
          )}
        </section>
      </div>

      {/* ============ 右：结果与可视化 ============ */}
      <div className="space-y-6 lg:col-span-3">
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">1RM 预测结果</h3>
          </div>

          {!filled ? (
            <div className="flex flex-col items-center justify-center rounded-ams border border-dashed border-ams-border py-14 text-center">
              <Dumbbell className="mb-2 h-8 w-8 text-ams-text-muted" />
              <p className="text-sm text-ams-text-secondary">
                {method === 'traditional' ? '请输入重量与次数数据' : '请输入负荷与平均速度数据'}
              </p>
              <p className="mt-1 text-xs text-ams-text-muted">
                {method === 'traditional'
                  ? '填写至少 1 组有效数据后自动计算'
                  : '填写至少 2 组有效数据点后自动回归外推'}
              </p>
            </div>
          ) : displayErrors.length > 0 ? (
            <div className="space-y-2">
              {displayErrors.map((msg) => (
                <div key={msg} className="flex items-start gap-2 rounded-ams border border-ams-danger/40 bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {msg}
                </div>
              ))}
            </div>
          ) : result && result.method === 'traditional' ? (
            <TraditionalResultView result={result} report={report} copied={copied} onCopy={handleCopy} onDownload={handleDownload} />
          ) : result && result.method === 'velocity' ? (
            <VelocityResultView result={result} report={report} copied={copied} onCopy={handleCopy} onDownload={handleDownload} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

/* ================= 传统法结果视图 ================= */

function TraditionalResultView({
  result,
  report,
  copied,
  onCopy,
  onDownload,
}: {
  result: ReturnType<typeof calculateTraditional>;
  report: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const chartData = result.perFormula.map((f) => ({
    label: f.label,
    oneRM: Math.round(f.oneRM * 10) / 10,
  }));

  return (
    <div className="space-y-5">
      {/* 关键参数摘要 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
          <div className="text-xs text-ams-text-muted">综合 1RM</div>
          <div className="mt-1 text-lg font-semibold text-ams-primary">
            {result.oneRM.toFixed(1)} <span className="text-xs font-normal text-ams-text-secondary">kg</span>
          </div>
          <div className="text-xs text-ams-text-secondary">6 公式 × {result.sets.length} 组平均</div>
        </div>
        <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
          <div className="text-xs text-ams-text-muted">数据组</div>
          <div className="mt-1 text-lg font-semibold text-ams-text-primary">
            {result.sets.length} <span className="text-xs font-normal text-ams-text-secondary">组</span>
          </div>
          <div className="text-xs text-ams-text-secondary">
            {result.sets.map((s, i) => `${s.weight.toFixed(0)}kg×${s.reps}`).join(' / ')}
          </div>
        </div>
        <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
          <div className="text-xs text-ams-text-muted">组间一致性 CV</div>
          <div className="mt-1 text-lg font-semibold text-ams-text-primary">
            {result.cv.toFixed(1)}%
          </div>
          <div className="text-xs text-ams-text-secondary">建议 ≤ 5%</div>
        </div>
      </div>

      {/* 各公式对比图 */}
      <div className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-full bg-ams-primary" />
            <span className="text-sm font-semibold text-ams-text-primary">各公式 1RM 估算对比</span>
          </div>
          <span className="text-xs text-ams-text-muted">横轴为估算 1RM（kg）</span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, Math.ceil(Math.max(...chartData.map((d) => d.oneRM)) * 1.15)]} tickFormatter={(v: number) => String(Math.round(v))} label={{ value: '1RM (kg)', position: 'insideBottom', offset: 4, fill: '#8B98A9', fontSize: 11 }} {...axisProps} />
              <YAxis type="category" dataKey="label" width={118} tick={{ fill: '#8B98A9', fontSize: 11 }} axisLine={{ stroke: '#1E3A5F' }} tickLine={{ stroke: '#1E3A5F' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)} kg`, '估算 1RM']} />
              <Bar name="估算 1RM" dataKey="oneRM" fill="#FF6B35" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-ams-text-muted">
          综合 1RM = {result.oneRM.toFixed(1)} kg（各公式取平均）；不同公式间的差异反映模型假设差异，属正常现象
        </p>
      </div>

      {/* 各公式明细表 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="ams-table-header">
              <th className="px-3 py-2 text-left">公式</th>
              <th className="px-3 py-2 text-left">来源</th>
              <th className="px-3 py-2 text-left">估算 1RM（kg）</th>
              <th className="px-3 py-2 text-left">相对综合值</th>
            </tr>
          </thead>
          <tbody>
            {result.perFormula.map((f) => {
              const diffPct = ((f.oneRM - result.oneRM) / result.oneRM) * 100;
              return (
                <tr key={f.key} className="border-t border-ams-border/50">
                  <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap">{f.label}</td>
                  <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">{f.source}</td>
                  <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap font-medium">{f.oneRM.toFixed(1)}</td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${Math.abs(diffPct) > 3 ? 'text-ams-warning' : 'text-ams-text-secondary'}`}>
                    {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* %1RM 载荷处方 */}
      <div className="overflow-x-auto">
        <div className="mb-1 text-xs font-medium text-ams-text-muted">%1RM 载荷处方（基于综合 1RM = {result.oneRM.toFixed(1)} kg）</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="ams-table-header">
              <th className="px-3 py-2 text-left">%1RM</th>
              <th className="px-3 py-2 text-left">训练重量（kg）</th>
              <th className="px-3 py-2 text-left">目标次数（RM）</th>
              <th className="px-3 py-2 text-left">强度区间</th>
            </tr>
          </thead>
          <tbody>
            {result.prescription.map((p) => (
              <tr key={p.pct} className="border-t border-ams-border/50">
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      p.pct >= 85
                        ? 'border-ams-primary/60 text-ams-primary'
                        : p.pct >= 70
                          ? 'border-ams-warning/60 text-ams-warning'
                          : 'border-ams-info/60 text-ams-info'
                    }`}
                  >
                    {p.pct}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap font-medium">
                  {p.weight.toFixed(1)} kg
                </td>
                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                  {p.repsRange[0]}–{p.repsRange[1]} 次
                </td>
                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                  {p.pct >= 85 ? '力量/最大力量' : p.pct >= 70 ? '力量-爆发力' : '爆发力/速度'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 注意事项 */}
      {result.warnings.length > 0 && (
        <div className="space-y-1.5">
          {result.warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 rounded-ams border border-ams-warning/40 bg-ams-warning/10 px-3 py-2 text-sm text-ams-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* 综合报告 */}
      <ReportBlock report={report} copied={copied} onCopy={onCopy} onDownload={onDownload} />
    </div>
  );
}

/* ================= 速度法结果视图 ================= */

function VelocityResultView({
  result,
  report,
  copied,
  onCopy,
  onDownload,
}: {
  result: ReturnType<typeof calculateVelocity>;
  report: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* 关键参数摘要 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
          <div className="text-xs text-ams-text-muted">外推 1RM</div>
          <div className="mt-1 text-lg font-semibold text-ams-primary">
            {result.oneRM.toFixed(1)} <span className="text-xs font-normal text-ams-text-secondary">kg</span>
          </div>
          <div className="text-xs text-ams-text-secondary">回归外推至 MVT</div>
        </div>
        <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
          <div className="text-xs text-ams-text-muted">拟合优度 R²</div>
          <div className="mt-1 text-lg font-semibold text-ams-text-primary">
            {result.r2.toFixed(3)}
          </div>
          <div className="text-xs text-ams-text-secondary">建议 ≥ 0.95</div>
        </div>
        <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
          <div className="text-xs text-ams-text-muted">1RM 速度阈值 MVT</div>
          <div className="mt-1 text-lg font-semibold text-ams-text-primary">
            {result.mvt.toFixed(2)} <span className="text-xs font-normal text-ams-text-secondary">m/s</span>
          </div>
          <div className="text-xs text-ams-text-secondary">回归方程 {result.equation}</div>
        </div>
      </div>

      {/* 速度-负荷回归图 */}
      <div className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-full bg-ams-primary" />
            <span className="text-sm font-semibold text-ams-text-primary">速度-负荷回归</span>
          </div>
          <span className="text-xs text-ams-text-muted">V = {result.intercept.toFixed(3)} {result.slope < 0 ? '−' : '+'} {Math.abs(result.slope).toFixed(4)}·L</span>
        </div>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={result.curve} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
              <XAxis
                dataKey="load"
                domain={[0, Math.ceil(result.oneRM * 1.1)]}
                type="number"
                tickCount={7}
                tickFormatter={(v: number) => String(Math.round(v))}
                label={{ value: '负荷 (kg)', position: 'insideBottom', offset: 4, fill: '#8B98A9', fontSize: 11 }}
                {...axisProps}
              />
              <YAxis
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                allowDecimals
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: '平均速度 (m/s)', angle: -90, position: 'insideLeft', offset: 15, fill: '#8B98A9', fontSize: 11, style: { textAnchor: 'middle' } }}
                {...axisProps}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label: number) => `负荷 ${Number(label).toFixed(1)} kg`}
                formatter={(value: number, name: string, item: { dataKey?: string | number }) => {
                  if (item?.dataKey === 'v') return [value.toFixed(3), '实测平均速度'];
                  return [value.toFixed(3), '回归预测速度'];
                }}
              />
              <Legend verticalAlign="top" height={32} content={renderLegend} />
              <ReferenceLine y={result.mvt} stroke="#60A5FA" strokeDasharray="4 4" label={{ value: 'MVT', position: 'insideTopLeft', fill: '#60A5FA', fontSize: 11 }} />
              <Line name="速度-负荷回归线" type="linear" dataKey="velocity" stroke="#FF6B35" strokeWidth={2.5} dot={false} />
              <Scatter
                name="实测数据点"
                data={result.points}
                dataKey="velocity"
                fill="#00E5A0"
                shape="circle"
              />
              <ReferenceDot x={result.oneRM} y={result.mvt} r={4} fill="#FF6B35" stroke="#FF6B35" label={{ value: `1RM = ${result.oneRM.toFixed(1)} kg`, position: 'right', fill: '#FFB800', fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-ams-text-muted">
          实测数据点（绿）落在回归线（橙）附近（R² = {result.r2.toFixed(3)}）；回归线外推到 MVT = {result.mvt.toFixed(2)} m/s（蓝虚线）对应的负荷即 1RM = {result.oneRM.toFixed(1)} kg（橙色圆点）
        </p>
      </div>

      {/* %1RM 目标速度表 */}
      <div className="overflow-x-auto">
        <div className="mb-1 text-xs font-medium text-ams-text-muted">%1RM 目标速度表（VBT 训练中按目标速度指导负荷）</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="ams-table-header">
              <th className="px-3 py-2 text-left">%1RM</th>
              <th className="px-3 py-2 text-left">训练重量（kg）</th>
              <th className="px-3 py-2 text-left">目标平均速度（m/s）</th>
              <th className="px-3 py-2 text-left">强度区间</th>
            </tr>
          </thead>
          <tbody>
            {result.velocityTable.map((v) => (
              <tr key={v.pct} className="border-t border-ams-border/50">
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      v.pct >= 85
                        ? 'border-ams-primary/60 text-ams-primary'
                        : v.pct >= 70
                          ? 'border-ams-warning/60 text-ams-warning'
                          : 'border-ams-info/60 text-ams-info'
                    }`}
                  >
                    {v.pct}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap font-medium">
                  {((result.oneRM * v.pct) / 100).toFixed(1)} kg
                </td>
                <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap font-medium">
                  {v.velocity.toFixed(3)}
                </td>
                <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                  {v.pct >= 85 ? '力量/最大力量' : v.pct >= 70 ? '力量-爆发力' : '爆发力/速度'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 注意事项 */}
      {result.warnings.length > 0 && (
        <div className="space-y-1.5">
          {result.warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 rounded-ams border border-ams-warning/40 bg-ams-warning/10 px-3 py-2 text-sm text-ams-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* 综合报告 */}
      <ReportBlock report={report} copied={copied} onCopy={onCopy} onDownload={onDownload} />
    </div>
  );
}

/* ================= 报告区块 ================= */

function ReportBlock({
  report,
  copied,
  onCopy,
  onDownload,
}: {
  report: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-ams border border-ams-border/60">
      <div className="flex items-center justify-between border-b border-ams-border/60 px-4 py-2.5">
        <span className="text-sm font-medium text-ams-text-primary">综合分析报告</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1 rounded-ams px-2 py-1 text-xs text-ams-text-secondary transition-colors hover:bg-ams-surface-hover hover:text-ams-primary"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? '已复制' : '复制'}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="flex items-center gap-1 rounded-ams px-2 py-1 text-xs text-ams-text-secondary transition-colors hover:bg-ams-surface-hover hover:text-ams-primary"
          >
            <Download className="h-3.5 w-3.5" />
            导出 TXT
          </button>
        </div>
      </div>
      <pre className="ams-scrollbar max-h-72 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-ams-text-secondary">
        {report}
      </pre>
    </div>
  );
}
