'use client';

/**
 * FVP Profile（力-速度-功率剖面）工具
 * 基于 Jean-Benoît Morin & Pierre Samozino 团队的力-速度-功率剖面评估方法
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Copy,
  Download,
  Gauge,
  Info,
  Plus,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FVP_TEMPLATES,
  buildFVPReport,
  calculateFVP,
  fitFVP,
  validateFVPInputs,
  type FVPTestMode,
  type FVPPoint,
} from '@/lib/sport-science/fvp-profile';

interface Athlete {
  id: number;
  name: string;
  weight: number | null;
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

/** 自定义图例：内容自适应宽度的居中色块图例，避免整行背景遮挡坐标轴刻度 */
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

/** 剖面类型徽章配色 */
const PROFILE_STYLES: Record<string, string> = {
  balanced: 'border-ams-success/60 text-ams-success',
  'force-dominant': 'border-ams-primary/60 text-ams-primary',
  'velocity-dominant': 'border-ams-info/60 text-ams-info',
};

export function FVPProfileTool() {
  // 运动员（可选，用于报告姓名与体重自动填充）
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteName, setAthleteName] = useState('');

  // 测试设置
  const [mode, setMode] = useState<FVPTestMode>('sprint');
  const [inputMode, setInputMode] = useState<'direct' | 'points'>('direct');
  const [bodyMass, setBodyMass] = useState('');
  const [f0, setF0] = useState('');
  const [v0, setV0] = useState('');
  const [rows, setRows] = useState<{ velocity: string; force: string }[]>([
    { velocity: '', force: '' },
    { velocity: '', force: '' },
    { velocity: '', force: '' },
  ]);
  const [templateKey, setTemplateKey] = useState('sprint');
  const [soptInput, setSoptInput] = useState('-0.85');
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
    if (a) {
      setAthleteName(a.name);
      if (a.weight != null && a.weight > 0) setBodyMass(String(a.weight));
    } else {
      setAthleteName('');
    }
  };

  /** 切换测试模式时，同步推荐对应参考模板 */
  const handleModeChange = (m: FVPTestMode) => {
    setMode(m);
    setTemplateKey(m === 'sprint' ? 'sprint' : 'jump');
    setSoptInput(m === 'sprint' ? '-0.85' : '-6.0');
  };

  const template = FVP_TEMPLATES.find((t) => t.key === templateKey);
  const sopt = templateKey === 'custom' ? Number(soptInput) : (template?.refSopt ?? -0.85);

  // 数据点模式的拟合结果
  const fit = useMemo(() => {
    if (inputMode !== 'points') return { ok: false as const, error: null as string | null };
    const pts: FVPPoint[] = rows
      .map((r) => ({ velocity: Number(r.velocity), force: Number(r.force) }))
      .filter((p) => Number.isFinite(p.velocity) && p.velocity > 0 && Number.isFinite(p.force) && p.force > 0);
    if (pts.length < 2) return { ok: false as const, error: null as string | null };
    try {
      const { f0: fitF0, v0: fitV0, r2 } = fitFVP(pts);
      return { ok: true as const, f0: fitF0, v0: fitV0, r2, error: null };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : '拟合失败' };
    }
  }, [inputMode, rows]);

  const bodyMassNum = Number(bodyMass);
  const f0Num = inputMode === 'direct' ? Number(f0) : (fit.ok ? fit.f0 : NaN);
  const v0Num = inputMode === 'direct' ? Number(v0) : (fit.ok ? fit.v0 : NaN);

  // 是否已具备计算条件
  const filled =
    bodyMass.trim() !== '' &&
    (inputMode === 'direct'
      ? f0.trim() !== '' && v0.trim() !== ''
      : fit.ok && !fit.error);

  const errors = useMemo(() => {
    if (!filled) return [] as string[];
    const errs = validateFVPInputs({ bodyMass: bodyMassNum, f0: f0Num, v0: v0Num, sopt });
    if (inputMode === 'points' && fit.ok && fit.r2 < 0.95) {
      errs.push(`线性拟合优度 R² = ${fit.r2.toFixed(3)}，低于 0.95，数据可靠性欠佳，建议检查数据点`);
    }
    if (fit.error) errs.push(fit.error);
    return errs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, bodyMassNum, f0Num, v0Num, sopt, fit, inputMode]);

  const result = useMemo(() => {
    if (errors.length > 0 || !filled) return null;
    return calculateFVP({
      mode,
      bodyMass: bodyMassNum,
      f0: f0Num,
      v0: v0Num,
      sopt,
      r2: inputMode === 'points' && fit.ok ? fit.r2 : null,
    });
  }, [errors, filled, mode, bodyMassNum, f0Num, v0Num, sopt, fit, inputMode]);

  const profileStyle = result ? PROFILE_STYLES[result.profileType] : '';

  const report = useMemo(
    () => (result ? buildFVPReport(result, athleteName || undefined) : ''),
    [result, athleteName]
  );

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
    a.download = `${athleteName || 'athlete'}-FVP-profile-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ============ 左：测试设置 ============ */}
      <div className="space-y-6 lg:col-span-2">
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-ams-primary" />
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
              <p className="mt-1 text-xs text-ams-text-muted">选中后将自动填入体重（如有记录）</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                体重（kg）<span className="text-ams-danger">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={300}
                step="0.1"
                value={bodyMass}
                onChange={(e) => setBodyMass(e.target.value)}
                placeholder="如：75"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">测试模式</label>
              <div className="grid grid-cols-2 gap-2">
                {(['sprint', 'jump'] as FVPTestMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeChange(m)}
                    className={`rounded-ams border px-3 py-2 text-sm transition-colors ${
                      mode === m
                        ? 'border-ams-primary bg-ams-primary/10 text-ams-primary font-medium'
                        : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50'
                    }`}
                  >
                    {m === 'sprint' ? '水平冲刺' : '垂直跳跃'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ams-text-muted">
                {mode === 'sprint'
                  ? '通过抗阻冲刺测试拟合水平力-速度关系（F₀、v₀ 为水平方向理论最大值）'
                  : '通过不同负荷深蹲跳测试拟合垂直力-速度关系（F₀、v₀ 为垂直方向理论最大值）'}
              </p>
            </div>
          </div>
        </section>

        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">力与速度参数</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">数据输入方式</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('direct')}
                  className={`rounded-ams border px-3 py-2 text-sm transition-colors ${
                    inputMode === 'direct'
                      ? 'border-ams-primary bg-ams-primary/10 text-ams-primary font-medium'
                      : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50'
                  }`}
                >
                  直接输入参数
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('points')}
                  className={`rounded-ams border px-3 py-2 text-sm transition-colors ${
                    inputMode === 'points'
                      ? 'border-ams-primary bg-ams-primary/10 text-ams-primary font-medium'
                      : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50'
                  }`}
                >
                  数据点拟合
                </button>
              </div>
            </div>

            {inputMode === 'direct' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                    理论最大力 F₀（N）<span className="text-ams-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={f0}
                    onChange={(e) => setF0(e.target.value)}
                    placeholder="如：640"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                    理论最大速度 v₀（m/s）<span className="text-ams-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={v0}
                    onChange={(e) => setV0(e.target.value)}
                    placeholder="如：9.8"
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ams-text-muted">
                  <span>速度（m/s）与对应水平/垂直力（N）数据点</span>
                  <span className="text-ams-text-secondary">至少 2 组，建议 4–6 组</span>
                </div>
                <div className="overflow-hidden rounded-ams border border-ams-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="ams-table-header">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">速度（m/s）</th>
                        <th className="px-3 py-2 text-left">力（N）</th>
                        <th className="w-10 px-1 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-ams-border/50">
                          <td className="px-3 py-1.5 text-xs text-ams-text-muted">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={r.velocity}
                              onChange={(e) => {
                                const next = [...rows];
                                next[i] = { ...next[i], velocity: e.target.value };
                                setRows(next);
                              }}
                              placeholder="0.0"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={r.force}
                              onChange={(e) => {
                                const next = [...rows];
                                next[i] = { ...next[i], force: e.target.value };
                                setRows(next);
                              }}
                              placeholder="0"
                              className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {rows.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                                className="rounded p-1 text-ams-text-muted hover:text-ams-danger"
                                title="删除该行"
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
                  onClick={() => setRows([...rows, { velocity: '', force: '' }])}
                  className="flex items-center gap-1 text-xs font-medium text-ams-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加数据点
                </button>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                运动项目参考模板
              </label>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                className={inputCls}
              >
                {FVP_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
                <option value="custom">自定义（手动输入最优斜率）</option>
              </select>
              <p className="mt-1 text-xs text-ams-text-muted">
                {template ? template.desc : '手动输入参考最优斜率，用于力速失衡（FVimb）计算'}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                参考最优斜率 SFV_opt（s⁻¹）
              </label>
              {templateKey === 'custom' ? (
                <input
                  type="number"
                  step="0.01"
                  value={soptInput}
                  onChange={(e) => setSoptInput(e.target.value)}
                  placeholder="如：-0.85"
                  className={inputCls}
                />
              ) : (
                <input type="text" value={template?.refSopt.toFixed(2)} readOnly disabled className={inputCls} />
              )}
              <p className="mt-1 text-xs text-ams-text-muted">
                由参考模板自动提供；负值表示力随速度增大而线性下降
              </p>
            </div>
          </div>
        </section>

        <section className="ams-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">测试方法说明</h3>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-ams-text-secondary">
            <li>水平冲刺：进行多次不同阻力（如 0%、10%、25%、40% 体重抗阻）的最大用力冲刺，记录前段加速的平均速度与水平力。</li>
            <li>垂直跳跃：在史密斯机上以不同负荷（0–80% 体重）完成最大用力蹲跳（SJ），记录起跳速度与负荷。</li>
            <li>力-速度关系呈良好线性（R² ≥ 0.95）时，拟合外推得到 F₀ 与 v₀ 才可靠。</li>
            <li>最大功率 Pmax 出现在力与速度各为理论最大值的 50% 处。</li>
          </ul>
        </section>
      </div>

      {/* ============ 右：结果与可视化 ============ */}
      <div className="space-y-6 lg:col-span-3">
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">FVP 剖面分析结果</h3>
          </div>

          {!filled ? (
            <div className="flex flex-col items-center justify-center rounded-ams border border-dashed border-ams-border py-14 text-center">
              <Activity className="mb-2 h-8 w-8 text-ams-text-muted" />
              <p className="text-sm text-ams-text-secondary">请填写体重与力/速度参数</p>
              <p className="mt-1 text-xs text-ams-text-muted">
                {inputMode === 'direct'
                  ? '输入 F₀ 与 v₀ 后自动计算剖面'
                  : '填写至少 2 组有效数据点后自动拟合并计算'}
              </p>
            </div>
          ) : errors.length > 0 ? (
            <div className="space-y-2">
              {errors.map((msg) => (
                <div key={msg} className="flex items-start gap-2 rounded-ams border border-ams-danger/40 bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {msg}
                </div>
              ))}
            </div>
          ) : result ? (
            <div className="space-y-5">
              {/* 关键参数摘要 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">理论最大力 F₀</div>
                  <div className="mt-1 text-lg font-semibold text-ams-primary">
                    {result.f0.toFixed(1)} <span className="text-xs font-normal text-ams-text-secondary">N</span>
                  </div>
                  <div className="text-xs text-ams-text-secondary">{result.f0Rel.toFixed(1)} N/kg</div>
                </div>
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">理论最大速度 v₀</div>
                  <div className="mt-1 text-lg font-semibold text-ams-primary">
                    {result.v0.toFixed(2)} <span className="text-xs font-normal text-ams-text-secondary">m/s</span>
                  </div>
                </div>
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">最大功率 Pmax</div>
                  <div className="mt-1 text-lg font-semibold text-ams-primary">
                    {result.pmax.toFixed(0)} <span className="text-xs font-normal text-ams-text-secondary">W</span>
                  </div>
                  <div className="text-xs text-ams-text-secondary">{result.pmaxRel.toFixed(1)} W/kg</div>
                </div>
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">力速斜率 SFV</div>
                  <div className="mt-1 text-lg font-semibold text-ams-text-primary">
                    {result.sfvRel.toFixed(2)} <span className="text-xs font-normal text-ams-text-secondary">s⁻¹</span>
                  </div>
                </div>
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">力速失衡 FVimb</div>
                  <div className="mt-1 text-lg font-semibold text-ams-text-primary">
                    {result.fvimb.toFixed(1)}%
                  </div>
                  <div className="text-xs text-ams-text-secondary">0% 为力速平衡</div>
                </div>
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">拟合优度 {result.r2 != null ? 'R²' : '最优功率速度'}</div>
                  {result.r2 != null ? (
                    <>
                      <div className="mt-1 text-lg font-semibold text-ams-text-primary">{result.r2.toFixed(3)}</div>
                      <div className="text-xs text-ams-text-secondary">建议 ≥ 0.95</div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 text-lg font-semibold text-ams-text-primary">{result.vOpt.toFixed(2)} <span className="text-xs font-normal text-ams-text-secondary">m/s</span></div>
                      <div className="text-xs text-ams-text-secondary">Pmax 对应速度（50% v₀）</div>
                    </>
                  )}
                </div>
              </div>

              {/* 力-速度剖面图 */}
              <div className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-ams-primary" />
                    <span className="text-sm font-semibold text-ams-text-primary">力-速度关系</span>
                  </div>
                  <span className="text-xs text-ams-text-muted">F(v) = F₀ −（F₀/v₀）·v</span>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={result.curve} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                      <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="v"
                        domain={[0, Math.max(result.v0, result.v0Opt) * 1.06]}
                        type="number"
                        tickCount={7}
                        tickFormatter={(v: number) => (Math.abs(v - Math.round(v)) < 0.0001 ? String(Math.round(v)) : v.toFixed(1))}
                        label={{ value: '速度 (m/s)', position: 'insideBottom', offset: 4, fill: '#8B98A9', fontSize: 11 }}
                        {...axisProps}
                      />
                      <YAxis
                        domain={[0, Math.ceil(Math.max(result.f0, result.f0Opt) * 1.1 - 1e-9)]}
                        allowDecimals={false}
                        tickFormatter={(value: number) => String(Math.round(value))}
                        label={{ value: '力 (N)', angle: -90, position: 'insideLeft', offset: 15, fill: '#8B98A9', fontSize: 11, style: { textAnchor: 'middle' } }}
                        {...axisProps}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: number) => `速度 ${Number(label).toFixed(2)} m/s`}
                        formatter={(value: number, name: string, item: { dataKey?: string | number }) => [Math.round(value), item?.dataKey === 'f' ? '力 (N)' : name]}
                      />
                      <Legend verticalAlign="top" height={32} content={renderLegend} />
                      <ReferenceLine x={result.vOpt} stroke="#FFB800" strokeDasharray="4 4" />
                      <Line name="力-速度拟合线" type="linear" dataKey="f" stroke="#FF6B35" strokeWidth={2.5} dot={false} />
                      <Line
                        name="最佳力速曲线（F-Vopt）"
                        type="linear"
                        data={result.curveOpt}
                        dataKey="fOpt"
                        stroke="#60A5FA"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                      {/* 关键点标注：F₀（v=0 力值）与两条曲线的横轴交点（v₀ / v0Opt） */}
                      <ReferenceDot x={0} y={result.f0} r={4} fill="#FF6B35" stroke="#FF6B35" label={{ value: `F₀ = ${result.f0.toFixed(0)} N`, position: 'right', fill: '#FFB800', fontSize: 11 }} />
                      <ReferenceDot x={result.v0} y={0} r={4} fill="#FF6B35" stroke="#FF6B35" label={{ value: `v₀ = ${result.v0.toFixed(2)} m/s`, position: 'top', fill: '#FFB800', fontSize: 11 }} />
                      <ReferenceDot x={result.v0Opt} y={0} r={4} fill="#60A5FA" stroke="#60A5FA" />
                      {inputMode === 'points' && (
                        <Scatter
                          name="实测数据点"
                          data={rows
                            .map((r) => ({ v: Number(r.velocity), f: Number(r.force) }))
                            .filter((p) => Number.isFinite(p.v) && p.v > 0 && Number.isFinite(p.f) && p.f > 0)}
                          dataKey="f"
                          fill="#00E5A0"
                          shape="circle"
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-xs text-ams-text-muted">
                  橙色曲线与横轴相交于 v₀ = {result.v0.toFixed(2)} m/s（理论最大速度，力 = 0），v = 0 处力值 F₀ = {result.f0.toFixed(0)} N；蓝色虚线为最佳力速曲线（F-Vopt），与横轴相交于 v = {result.v0Opt.toFixed(2)} m/s——两条曲线均与实测曲线共享最大功率点（橙色虚线 v = {result.vOpt.toFixed(2)} m/s），交点差异反映力速失衡方向
                </p>
              </div>

              {/* 图间视觉分割：分隔线明确划分两个图表区域 */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-ams-border" />
                <span className="text-xs font-medium tracking-wide text-ams-text-muted">功率输出特征</span>
                <div className="h-px flex-1 bg-ams-border" />
              </div>

              {/* 功率-速度曲线 */}
              <div className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-ams-warning" />
                    <span className="text-sm font-semibold text-ams-text-primary">功率-速度曲线</span>
                  </div>
                  <span className="text-xs text-ams-text-muted">P(v) = F₀·v −（F₀/v₀）·v²</span>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.curve} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                      <defs>
                        <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                      <XAxis dataKey="v" domain={[0, 'dataMax']} type="number" label={{ value: '速度 (m/s)', position: 'insideBottom', offset: 4, fill: '#8B98A9', fontSize: 11 }} {...axisProps} />
                      <YAxis
                        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                        allowDecimals={false}
                        tickFormatter={(value: number) => String(Math.round(value))}
                        label={{ value: '功率 (W)', angle: -90, position: 'insideLeft', offset: 15, fill: '#8B98A9', fontSize: 11, style: { textAnchor: 'middle' } }}
                        {...axisProps}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: number) => `速度 ${Number(label).toFixed(2)} m/s`}
                        formatter={(value: number) => [`${value.toFixed(0)} W`, '功率']}
                      />
                      <Legend verticalAlign="top" height={32} content={renderLegend} />
                      <ReferenceArea x1={result.power90.vMin} x2={result.power90.vMax} fill="#FFB800" fillOpacity={0.12} />
                      <ReferenceLine x={result.vOpt} stroke="#FFB800" strokeDasharray="4 4" />
                      <Area name="功率曲线" type="monotone" dataKey="p" stroke="#FF6B35" strokeWidth={2.5} fill="url(#powerGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-xs text-ams-text-muted">
                  黄色阴影区为最优功率区（功率 ≥ 90% Pmax）：{result.power90.vMin.toFixed(2)} – {result.power90.vMax.toFixed(2)} m/s
                </p>
              </div>

              {/* 分级功率区间 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="ams-table-header">
                      <th className="px-3 py-2 text-left">区间</th>
                      <th className="px-3 py-2 text-left">速度范围（m/s）</th>
                      <th className="px-3 py-2 text-left">功率范围（W）</th>
                      <th className="px-3 py-2 text-left">训练指向</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.zones.map((z) => (
                      <tr key={z.name} className="border-t border-ams-border/50">
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center rounded-full border border-ams-border/60 px-2 py-0.5 text-xs font-medium text-ams-text-primary">
                            {z.name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">
                          {z.vMin != null && z.vMax != null ? `${z.vMin.toFixed(2)} – ${z.vMax.toFixed(2)}` : ''}
                        </td>
                        <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap">
                          {z.pMin != null && z.pMax != null ? `${z.pMin.toFixed(0)} – ${z.pMax.toFixed(0)}` : ''}
                        </td>
                        <td className="px-3 py-2.5 text-ams-text-secondary leading-relaxed">{z.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 剖面解读与训练建议 */}
              <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold ${profileStyle}`}>
                    {result.profileLabel}
                  </span>
                  <span className="text-xs text-ams-text-muted">
                    实际斜率 / 最优斜率 = {result.ratio.toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ams-text-secondary">{result.profileDesc}</p>
                <div className="mt-3 space-y-1.5 border-t border-ams-border/50 pt-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-ams-text-primary">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ams-primary/15 text-[10px] font-bold text-ams-primary">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 综合报告 */}
              <div className="rounded-ams border border-ams-border/60">
                <div className="flex items-center justify-between border-b border-ams-border/60 px-4 py-2.5">
                  <span className="text-sm font-medium text-ams-text-primary">综合分析报告</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 rounded-ams px-2 py-1 text-xs text-ams-text-secondary transition-colors hover:bg-ams-surface-hover hover:text-ams-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? '已复制' : '复制'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
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
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
