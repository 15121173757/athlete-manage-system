'use client';

/**
 * 运动科学工具箱 —— VO₂max 最大摄氧量现场估算
 *
 * 5 种循证现场测试方法（Cooper 12 分钟跑 / 1.5 英里跑 / 6 分钟步行 /
 * Astrand-Ryhming 踏车法 / Bruce 跑台协议），输出 VO₂max、性别+年龄分级、
 * %VO₂max 训练强度带与报告导出。
 */

import { useMemo, useState, useEffect } from 'react';
import {
  Activity, Timer, Footprints, Bike, TrendingUp, ChevronRight,
  FileText, Copy, Download, RotateCcw, Check, Loader2,
  ClipboardList, Package, ListOrdered, CheckCircle2, AlertTriangle, ShieldAlert, BookOpen,
} from 'lucide-react';
import {
  VO2_METHODS, GRADING_TABLE, GRADING_LABELS, ELITE_REF,
  BaseInput, MethodInput, Sex, Vo2Result, Vo2Method,
  estimateVo2max, getGrade, buildZones, buildReport, buildReportSections,
} from '@/lib/sport-science/vo2max-estimation';

const inputCls =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

const METHOD_ICONS: Record<Vo2Method, React.ComponentType<{ className?: string }>> = {
  cooper12: Timer,
  mile15: Footprints,
  walk6: Activity,
  astrand: Bike,
  bruce: TrendingUp,
};

interface Athlete {
  id: number;
  name: string;
  gender: string;
  weight: string;
  birthDate: string;
}

/** 数字输入辅助 */
const num = (v: string): number | '' => (v === '' ? '' : Number(v));

export function VO2maxTool() {
  // ---------- 基础信息 ----------
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteName, setAthleteName] = useState('');
  const [sex, setSex] = useState<Sex>('MALE');
  const [age, setAge] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [restHR, setRestHR] = useState<number | ''>('');

  // ---------- 方法选择 ----------
  const [method, setMethod] = useState<Vo2Method>('cooper12');
  // 方法专属输入
  const [cooperDist, setCooperDist] = useState('');
  const [mileMin, setMileMin] = useState('');
  const [mileSec, setMileSec] = useState('');
  const [walkDist, setWalkDist] = useState('');
  const [astrandPower, setAstrandPower] = useState('');
  const [astrandHR, setAstrandHR] = useState('');
  const [bruceMin, setBruceMin] = useState('');
  const [bruceSec, setBruceSec] = useState('');

  const [result, setResult] = useState<Vo2Result | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    if (!a) return;
    setAthleteName(a.name);
    setSex(a.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
    if (a.weight) setWeight(Number(a.weight));
    if (a.birthDate) {
      setAge(Math.max(10, Math.floor((Date.now() - new Date(a.birthDate).getTime()) / 31536000000)));
    }
  };

  // ---------- 计算 ----------
  const canCompute =
    typeof age === 'number' && age > 0 &&
    (method === 'astrand' ? typeof weight === 'number' && weight > 0 : true) &&
    (() => {
      switch (method) {
        case 'cooper12': return Number(cooperDist) > 0;
        case 'mile15': return Number(mileMin) > 0 || Number(mileSec) > 0;
        case 'walk6': return Number(walkDist) > 0;
        case 'astrand': return Number(astrandPower) > 0 && Number(astrandHR) > 0;
        case 'bruce': return Number(bruceMin) > 0 || Number(bruceSec) > 0;
        default: return false;
      }
    })();

  const compute = () => {
    if (!canCompute) return;
    setError('');
    try {
      const base: BaseInput = {
        sex, age: age as number, weight: weight === '' ? 0 : (weight as number),
        restHR: restHR === '' ? '' : (restHR as number),
      };
      let input: MethodInput;
      switch (method) {
        case 'cooper12': input = { method, distance: Number(cooperDist) }; break;
        case 'mile15': input = { method, minutes: Number(mileMin) || 0, seconds: Number(mileSec) || 0 }; break;
        case 'walk6': input = { method, distance: Number(walkDist) }; break;
        case 'astrand': input = { method, power: Number(astrandPower), steadyHR: Number(astrandHR) }; break;
        case 'bruce': input = { method, minutes: Number(bruceMin) || 0, seconds: Number(bruceSec) || 0 }; break;
      }
      const { vo2max, notes } = estimateVo2max(input, base);
      const grade = getGrade(sex, age as number, vo2max);
      const zones = buildZones(vo2max, base);
      const vo2maxL = weight !== '' && (weight as number) > 0 ? (vo2max * (weight as number)) / 1000 : null;
      const m = VO2_METHODS.find((x) => x.key === method)!;
      setResult({
        methodKey: method,
        methodLabel: m.label,
        vo2max,
        vo2maxL,
        gradeIndex: grade.index,
        gradeLabel: grade.label,
        gradeDesc: grade.desc,
        notes,
        zones,
        report: buildReport(base, m.label, vo2max, vo2maxL, grade, notes, zones),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败，请检查输入');
      setResult(null);
    }
  };

  // 分级对照表（当前性别）
  const gradeTable = useMemo(() => GRADING_TABLE.filter((g) => g.sex === sex), [sex]);

  // ---------- 导出 ----------
  const downloadTXT = () => {
    if (!result) return;
    const blob = new Blob([result.report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vo2max-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const sections = buildReportSections(
        { sex, age: age as number, weight: weight === '' ? 0 : (weight as number), restHR },
        result.methodLabel, result.vo2max, result.vo2maxL,
        { index: result.gradeIndex, label: result.gradeLabel, desc: result.gradeDesc },
        result.notes, result.zones
      );
      const resp = await fetch('/api/sport-science/report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'VO₂max 最大摄氧量评估报告',
          subtitle: `评估方法：${result.methodLabel}${athleteName ? `    运动员：${athleteName}` : ''}`,
          generatedAt: new Date().toLocaleString('zh-CN'),
          sections,
        }),
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vo2max-report-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF 导出失败，请重试或使用 TXT 导出');
    } finally {
      setExporting(false);
    }
  };

  const copyReport = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.report);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = result.report;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
      } catch { /* 忽略 */ }
    }
    setTimeout(() => setCopied(false), 1500);
  };

  const activeMethod = VO2_METHODS.find((m) => m.key === method)!;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ============ 左：评估设置 ============ */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* 基础信息 */}
          <section className="ams-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">基础信息</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">选择运动员（可选，自动预填）</label>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">性别</label>
                  <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={inputCls}>
                    <option value="MALE">男</option>
                    <option value="FEMALE">女</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">年龄（岁）</label>
                  <input type="number" min={10} max={80} value={age} onChange={(e) => setAge(num(e.target.value))} placeholder="如：24" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">体重（kg）</label>
                  <input type="number" min={30} max={200} value={weight} onChange={(e) => setWeight(num(e.target.value))} placeholder="踏车法必填" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">静息心率（可选）</label>
                  <input type="number" min={35} max={100} value={restHR} onChange={(e) => setRestHR(num(e.target.value))} placeholder="用于强度带心率" className={inputCls} />
                </div>
              </div>
            </div>
          </section>

          {/* 方法选择 */}
          <section className="ams-card flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <Timer className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">评估方法</h3>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {VO2_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m.key];
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => { setMethod(m.key); setResult(null); setError(''); }}
                    className={`flex flex-1 items-center gap-3 rounded-ams border px-3 py-2.5 text-left transition-colors ${
                      method === m.key
                        ? 'border-ams-primary bg-ams-primary/10'
                        : 'border-ams-border/60 bg-ams-surface hover:border-ams-primary/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${method === m.key ? 'text-ams-primary' : 'text-ams-text-secondary'}`} />
                    <div className="min-w-0">
                      <div className={`text-sm font-medium ${method === m.key ? 'text-ams-primary' : 'text-ams-text-primary'}`}>{m.label}</div>
                      <div className="truncate text-xs text-ams-text-muted">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 方法专属输入 */}
          <section className="ams-card flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">{activeMethod.label} · 测试数据</h3>
            </div>

            {method === 'cooper12' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">12 分钟跑距离（m）</label>
                <input type="number" min={500} max={6000} value={cooperDist} onChange={(e) => setCooperDist(e.target.value)} placeholder="如：2800" className={inputCls} />
                <p className="mt-1.5 text-xs text-ams-text-muted">{activeMethod.formula}</p>
              </div>
            )}

            {method === 'mile15' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">完成时间（分）</label>
                  <input type="number" min={0} max={30} value={mileMin} onChange={(e) => setMileMin(e.target.value)} placeholder="如：11" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">完成时间（秒）</label>
                  <input type="number" min={0} max={59} value={mileSec} onChange={(e) => setMileSec(e.target.value)} placeholder="如：30" className={inputCls} />
                </div>
              </div>
            )}

            {method === 'walk6' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">6 分钟步行距离（m）</label>
                <input type="number" min={100} max={1500} value={walkDist} onChange={(e) => setWalkDist(e.target.value)} placeholder="如：520" className={inputCls} />
                <p className="mt-1.5 text-xs text-ams-text-muted">{activeMethod.formula}（次极量法，适合康复/耐力弱势人群）</p>
              </div>
            )}

            {method === 'astrand' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">蹬车功率（W）</label>
                  <input type="number" min={25} max={500} value={astrandPower} onChange={(e) => setAstrandPower(e.target.value)} placeholder="如：150" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">稳态心率（bpm）</label>
                  <input type="number" min={90} max={200} value={astrandHR} onChange={(e) => setAstrandHR(e.target.value)} placeholder="如：150" className={inputCls} />
                </div>
              </div>
            )}

            {method === 'bruce' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">测试总时间（分）</label>
                  <input type="number" min={0} max={25} value={bruceMin} onChange={(e) => setBruceMin(e.target.value)} placeholder="如：9" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">测试总时间（秒）</label>
                  <input type="number" min={0} max={59} value={bruceSec} onChange={(e) => setBruceSec(e.target.value)} placeholder="如：30" className={inputCls} />
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-ams border border-ams-danger/40 bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">{error}</p>
            )}

            <button
              type="button"
              disabled={!canCompute}
              onClick={compute}
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <TrendingUp className="h-4 w-4" /> 估算 VO₂max
            </button>
          </section>
        </div>

        {/* ============ 右：说明与对照 ============ */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <section className="ams-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ams-text-primary">有氧能力分级参考（ACSM · {sex === 'MALE' ? '男' : '女'}）</h3>
              <span className="text-xs text-ams-text-muted">精英参考 ≥ {ELITE_REF[sex]} mL/kg/min</span>
            </div>
            <div className="overflow-hidden rounded-ams border border-ams-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ams-table-header">
                    <th className="px-3 py-2 text-left">年龄段</th>
                    {GRADING_LABELS.map((l) => (
                      <th key={l} className="px-3 py-2 text-center">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradeTable.map((g) => (
                    <tr key={`${g.sex}-${g.ageFrom}`} className="border-t border-ams-border/50">
                      <td className="px-3 py-2 text-ams-text-secondary">{g.ageFrom}-{g.ageTo} 岁</td>
                      {g.thresholds.slice(0, 5).map((t, i) => (
                        <td key={i} className={`px-3 py-2 text-center ${i === 4 ? 'font-medium text-ams-success' : ''}`}>
                          {i === 4 ? `≥${g.thresholds[3]}` : `≥${t}`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ams-text-muted">
              各档显示该档位 VO₂max 下界（mL/kg/min）。现场估算法存在约 ±10% 误差，用于训练分级参考。
            </p>
          </section>

          {/* 测试执行指南（随所选方法实时切换，与结果区强度带数据表解耦） */}
          <section className="ams-card flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">测试执行指南 · {activeMethod.label}</h3>
              <span className="ml-auto text-xs text-ams-text-muted">随所选方法实时切换</span>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              {/* 方法原理与计算依据（整合自原「方法说明」模块） */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ams-text-secondary">
                  <BookOpen className="h-3.5 w-3.5 text-ams-primary" />
                  方法原理与计算依据
                </div>
                <p className="text-xs leading-relaxed text-ams-text-secondary">{activeMethod.desc}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-ams-border bg-ams-background/60 px-2.5 py-1 text-xs text-ams-text-secondary">公式：{activeMethod.formula}</span>
                  <span className="rounded-full border border-ams-border bg-ams-background/60 px-2.5 py-1 text-xs text-ams-text-secondary">设备：{activeMethod.needEquip}</span>
                  <span className="rounded-full border border-ams-border bg-ams-background/60 px-2.5 py-1 text-xs text-ams-text-secondary">适用：{activeMethod.targets}</span>
                </div>
              </div>

              {/* 设备与场地 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ams-text-secondary">
                  <Package className="h-3.5 w-3.5 text-ams-primary" />
                  设备与场地
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeMethod.guide.equipment.map((e) => (
                    <span key={e} className="rounded-full border border-ams-border bg-ams-background/60 px-2.5 py-1 text-xs text-ams-text-secondary">{e}</span>
                  ))}
                </div>
              </div>

              {/* 测试前准备 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ams-text-secondary">
                  <CheckCircle2 className="h-3.5 w-3.5 text-ams-success" />
                  测试前准备
                </div>
                <ul className="space-y-1.5">
                  {activeMethod.guide.prep.map((p, i) => (
                    <li key={i} className="flex gap-2 text-xs text-ams-text-secondary">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ams-success" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 实施步骤 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ams-text-secondary">
                  <ListOrdered className="h-3.5 w-3.5 text-ams-primary" />
                  实施步骤
                </div>
                <ol className="space-y-1.5">
                  {activeMethod.guide.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-ams-text-secondary">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ams-primary/15 text-[10px] font-medium text-ams-primary">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>

              {/* 具体执行程序 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ams-text-secondary">
                  <TrendingUp className="h-3.5 w-3.5 text-ams-primary" />
                  具体执行程序
                </div>
                <div className="overflow-hidden rounded-ams border border-ams-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="ams-table-header">
                        <th className="px-3 py-2 text-left">阶段</th>
                        <th className="px-3 py-2 text-left">执行操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMethod.guide.exec.map((e) => (
                        <tr key={e.phase} className="border-t border-ams-border/50">
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-ams-primary">{e.phase}</td>
                          <td className="px-3 py-2 text-xs text-ams-text-secondary">{e.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 注意事项 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ams-text-secondary">
                  <AlertTriangle className="h-3.5 w-3.5 text-ams-warning" />
                  注意事项
                </div>
                <ul className="space-y-1.5">
                  {activeMethod.guide.notes.map((n, i) => (
                    <li key={i} className="flex gap-2 text-xs text-ams-text-secondary">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ams-warning" />
                      {n}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 安全终止指征 */}
              <div className="rounded-ams border border-ams-danger/40 bg-ams-danger/5 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ams-danger">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  安全终止指征（出现任一症状立即停止测试）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeMethod.guide.stop.map((s, i) => (
                    <span key={i} className="rounded-ams bg-ams-danger/10 px-2 py-0.5 text-xs text-ams-danger">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ============ 结果区 ============ */}
      {result && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-ams-text-secondary">
              <Activity className="h-4 w-4 text-ams-primary" />
              评估对象：<span className="font-medium text-ams-text-primary">{athleteName || '未指定'}</span>
              <span className="text-ams-text-muted">· {result.methodLabel}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyReport} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                {copied ? <Check className="h-4 w-4 text-ams-success" /> : <Copy className="h-4 w-4" />}
                复制报告
              </button>
              <button type="button" onClick={downloadTXT} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                <FileText className="h-4 w-4" /> 导出 TXT
              </button>
              <button type="button" onClick={exportPDF} disabled={exporting} className="inline-flex items-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? '生成中…' : '导出 PDF'}
              </button>
              <button type="button" onClick={() => setResult(null)} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                <RotateCcw className="h-4 w-4" /> 重新评估
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* VO₂max 主卡 */}
            <section className="ams-card p-6 text-center">
              <div className="text-xs text-ams-text-secondary">VO₂max（mL/kg/min）</div>
              <div className="mt-2 text-5xl font-bold text-ams-primary">{result.vo2max}</div>
              {result.vo2maxL != null && (
                <div className="mt-1 text-sm text-ams-text-muted">≈ {result.vo2maxL.toFixed(2)} L/min</div>
              )}
              <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${gradeBadgeCls(result.gradeIndex)}`}>
                有氧能力：{result.gradeLabel}
              </span>
              <p className="mt-3 text-sm text-ams-text-secondary">{result.gradeDesc}</p>
              <ul className="mt-3 space-y-1 text-left text-xs text-ams-text-muted">
                {result.notes.map((n, i) => <li key={i}>· {n}</li>)}
              </ul>
            </section>

            {/* 强度带 */}
            <section className="ams-card p-5 lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">训练强度带（基于 VO₂max {result.vo2max}）</h3>
              <div className="overflow-hidden rounded-ams border border-ams-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="ams-table-header">
                      <th className="px-3 py-2 text-left">区</th>
                      <th className="px-3 py-2 text-left">名称</th>
                      <th className="px-3 py-2 text-left">%VO₂max</th>
                      <th className="px-3 py-2 text-left">目标 VO₂max</th>
                      <th className="px-3 py-2 text-left">目标心率</th>
                      <th className="px-3 py-2 text-left">用途</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.zones.map((z) => (
                      <tr key={z.key} className="border-t border-ams-border/50">
                        <td className="px-3 py-2 font-medium text-ams-primary">{z.key}</td>
                        <td className="px-3 py-2">{z.name}</td>
                        <td className="px-3 py-2 text-ams-text-secondary">{z.pct[0]}-{z.pct[1]}%</td>
                        <td className="px-3 py-2">{z.vo2Range[0]}-{z.vo2Range[1]} mL/kg/min</td>
                        <td className="px-3 py-2 text-ams-text-secondary">
                          {z.hrRange ? `${z.hrRange[0]}-${z.hrRange[1]} bpm` : '—（填静息心率）'}
                        </td>
                        <td className="px-3 py-2 text-xs text-ams-text-muted">{z.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* 报告 */}
          <section className="ams-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">评估报告</h3>
              <span className="ml-auto text-xs text-ams-text-muted">支持复制 / TXT / PDF 导出</span>
            </div>
            <pre className="ams-scrollbar max-h-96 overflow-auto whitespace-pre-wrap rounded-ams border border-ams-border bg-ams-background p-4 font-mono text-xs leading-relaxed text-ams-text-secondary">
              {result.report}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}

function gradeBadgeCls(index: number): string {
  if (index >= 3) return 'bg-ams-success/15 text-ams-success';
  if (index === 2) return 'bg-ams-primary/15 text-ams-primary';
  return 'bg-ams-warning/15 text-ams-warning';
}
