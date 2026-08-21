'use client';

/**
 * 运动科学工具箱 —— FMS 功能性动作筛查
 *
 * 两种使用模式：
 * 1. 单人筛查：7 个基础动作逐项评分（0-3 分）+ 3 个清除测试，输出总分/风险分级/不对称检测/改进建议
 * 2. 批量导入：粘贴 CSV 或上传 xlsx，一次评估多人，支持结果导出（CSV / TXT / PDF）
 */
import { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Rows3,
  ScanSearch,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FMS_TESTS,
  CLEARING_TESTS,
  SCORE_LABELS,
  RISK_THRESHOLD,
  analyzeScreening,
  buildReport,
  buildReportSections,
  buildBatchTemplate,
  parseBatchCSV,
  buildBatchCSV,
  buildBatchReport,
  type FmsScoreInput,
  type ClearingInput,
  type ScreeningAnalysis,
  type BatchResult,
  type RiskLevel,
} from '@/lib/sport-science/movement-screen';

const inputCls =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

interface Athlete {
  id: number;
  name: string;
}

type Mode = 'single' | 'batch';

/** 0-3 分按钮组 */
function ScoreButtons({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[3, 2, 1, 0].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${
            value === s
              ? s === 0
                ? 'bg-ams-danger text-white'
                : 'bg-ams-primary text-white'
              : 'border border-ams-border bg-ams-background/60 text-ams-text-secondary hover:border-ams-primary/50'
          }`}
          title={SCORE_LABELS[s]}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

const EMPTY_SCORES: FmsScoreInput = {
  deepSquat: 2,
  hurdleStep: { left: 2, right: 2 },
  inLineLunge: { left: 2, right: 2 },
  shoulderMobility: { left: 2, right: 2 },
  activeStraightLegRaise: { left: 2, right: 2 },
  trunkStabilityPushup: 2,
  rotaryStability: { left: 2, right: 2 },
};

const EMPTY_CLEARINGS: ClearingInput = { shoulder: true, spinal: true, rocking: true };

const riskCls: Record<RiskLevel, string> = {
  低: 'bg-ams-success/15 text-ams-success',
  中: 'bg-ams-warning/15 text-ams-warning',
  高: 'bg-ams-danger/15 text-ams-danger',
};

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

export function MovementScreenTool() {
  const [mode, setMode] = useState<Mode>('single');

  // ---------- 单人模式 ----------
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteName, setAthleteName] = useState('');
  const [scores, setScores] = useState<FmsScoreInput>({ ...EMPTY_SCORES });
  const [clearings, setClearings] = useState<ClearingInput>({ ...EMPTY_CLEARINGS });
  const [showResult, setShowResult] = useState(false);

  // ---------- 批量模式 ----------
  const [csvText, setCsvText] = useState('');
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [parsing, setParsing] = useState(false);

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
    setAthleteName(a ? a.name : '');
  };

  const setSide = (
    key: 'hurdleStep' | 'inLineLunge' | 'shoulderMobility' | 'activeStraightLegRaise' | 'rotaryStability',
    side: 'left' | 'right',
    v: number
  ) => setScores((prev) => ({ ...prev, [key]: { ...prev[key], [side]: v } }));

  const setClear = (key: keyof ClearingInput, pain: boolean) =>
    setClearings((prev) => ({ ...prev, [key]: !pain }));

  // ---------- 单人分析 ----------
  const analysis = useMemo<ScreeningAnalysis | null>(() => {
    if (!showResult) return null;
    return analyzeScreening(scores, clearings, athleteName || '未指定');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult, scores, clearings, athleteName]);

  const reportText = useMemo(() => (analysis ? buildReport(analysis) : ''), [analysis]);

  const chartData = useMemo(
    () =>
      (analysis?.items ?? []).map((it) => ({
        name: it.test.short ?? it.test.name,
        full: it.test.name,
        得分: it.composite,
        asymmetric: it.asymmetric,
      })),
    [analysis]
  );

  // ---------- 批量解析 ----------
  const doParseCSV = (text: string) => {
    const res = parseBatchCSV(text);
    setBatchResult(res);
  };

  const handleFileUpload = async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      const lines = rows
        .filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== ''))
        .map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c)).trim()).join(','));
      doParseCSV(lines.join('\n'));
    } catch {
      alert('文件解析失败，请确认上传的是 .xlsx / .csv 文件且列格式与模板一致');
    } finally {
      setParsing(false);
      if (file) {
        const input = document.getElementById('batch-file') as HTMLInputElement;
        if (input) input.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildBatchTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FMS-批量导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- 导出 ----------
  const downloadTXT = () => {
    const text = mode === 'single' ? reportText : batchResult ? buildBatchReport(batchResult) : '';
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movement-screen-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (!batchResult || batchResult.rows.length === 0) return;
    const blob = new Blob(['\uFEFF' + buildBatchCSV(batchResult)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FMS-筛查结果-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (mode === 'single') {
      if (!analysis) return;
      setExporting(true);
      try {
        const resp = await fetch('/api/sport-science/report-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '功能性动作筛查报告（FMS）',
            subtitle: `受试者：${analysis.athleteName} · 总分 ${analysis.total}/21 · 风险 ${analysis.riskLevel}`,
            generatedAt: analysis.generatedAt,
            sections: buildReportSections(analysis),
          }),
        });
        if (!resp.ok) throw new Error('导出失败');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FMS-${analysis.athleteName}-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        alert('PDF 导出失败，请重试或使用 TXT 导出');
      } finally {
        setExporting(false);
      }
      return;
    }
    // 批量 PDF（汇总）
    if (!batchResult || batchResult.rows.length === 0) return;
    setExporting(true);
    try {
      const lines = batchResult.rows.map((r, i) => {
        const asym = r.analysis.asymmetricTests.length ? `，不对称 ${r.analysis.asymmetricTests.length} 项` : '';
        const pain = r.analysis.painTests.length ? `，疼痛：${r.analysis.painTests.join('、')}` : '';
        return `${i + 1}. ${r.name}：总分 ${r.analysis.total}/21，风险 ${r.analysis.riskLevel}${asym}${pain}`;
      });
      const resp = await fetch('/api/sport-science/report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'FMS 功能性动作筛查 · 批量评估汇总',
          subtitle: `筛查人数：${batchResult.validCount}`,
          generatedAt: new Date().toLocaleString('zh-CN'),
          sections: [
            { heading: '评估结果汇总', lines },
            {
              heading: '风险统计',
              lines: [
                `低风险：${batchResult.rows.filter((r) => r.analysis.riskLevel === '低').length} 人`,
                `中风险：${batchResult.rows.filter((r) => r.analysis.riskLevel === '中').length} 人`,
                `高风险：${batchResult.rows.filter((r) => r.analysis.riskLevel === '高').length} 人`,
                `存在左右不对称：${batchResult.rows.filter((r) => r.analysis.asymmetricTests.length > 0).length} 人`,
              ],
            },
            {
              heading: '建议',
              lines: [
                '1. 高风险（≤14 分或含疼痛动作）受试者：优先动作质量重建与医疗评估，暂缓高强度训练',
                '2. 中风险受试者：针对低分动作开展专项纠正训练，2-4 周后复测',
                '3. 所有受试者建议每 4-6 周定期复测，跟踪动作质量变化',
              ],
            },
          ],
        }),
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FMS-批量汇总-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF 导出失败，请重试或使用 TXT/CSV 导出');
    } finally {
      setExporting(false);
    }
  };

  const copyReport = async () => {
    const text = mode === 'single' ? reportText : batchResult ? buildBatchReport(batchResult) : '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        /* 静默 */
      }
    }
    setTimeout(() => setCopied(false), 1500);
  };

  const resetAll = () => {
    setShowResult(false);
    setScores({ ...EMPTY_SCORES });
    setClearings({ ...EMPTY_CLEARINGS });
    setCsvText('');
    setBatchResult(null);
  };

  // ---------- 渲染：评分输入卡（单人） ----------
  const renderScoreCard = () => (
    <section className="ams-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ScanSearch className="h-4 w-4 text-ams-primary" />
        <h3 className="text-sm font-semibold text-ams-text-primary">动作评分（0-3 分）</h3>
      </div>
      <div className="space-y-4">
        {FMS_TESTS.map((t) => {
          const val =
            t.key === 'deepSquat'
              ? scores.deepSquat
              : t.key === 'trunkStabilityPushup'
                ? scores.trunkStabilityPushup
                : null;
          const sideVal =
            t.key === 'hurdleStep'
              ? scores.hurdleStep
              : t.key === 'inLineLunge'
                ? scores.inLineLunge
                : t.key === 'shoulderMobility'
                  ? scores.shoulderMobility
                  : t.key === 'activeStraightLegRaise'
                    ? scores.activeStraightLegRaise
                    : t.key === 'rotaryStability'
                      ? scores.rotaryStability
                      : null;
          return (
            <div key={t.key} className="rounded-ams border border-ams-border/60 bg-ams-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-ams-text-primary">
                    <span className="mr-1.5">{t.icon}</span>
                    {t.name}
                    <span className="ml-1.5 text-xs font-normal text-ams-text-muted">{t.en}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ams-text-muted">{t.purpose}</p>
                </div>
              </div>
              {val !== null ? (
                <div className="mt-2.5">
                  <div className="mb-1 text-xs text-ams-text-muted">得分</div>
                  <ScoreButtons
                    value={val}
                    onChange={(v) => setScores((prev) => ({ ...prev, [t.key]: v }))}
                  />
                </div>
              ) : sideVal !== null ? (
                <div className="mt-2.5 grid grid-cols-2 gap-3">
                  {(['left', 'right'] as const).map((side) => (
                    <div key={side}>
                      <div className="mb-1 text-xs text-ams-text-muted">
                        {side === 'left' ? '左侧' : '右侧'}
                      </div>
                      <ScoreButtons
                        value={sideVal[side]}
                        onChange={(v) => setSide(t.key as Parameters<typeof setSide>[0], side, v)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              {t.key === 'deepSquat' && (
                <p className="mt-2 text-[11px] text-ams-text-muted">深蹲无关联清除测试，评分直接计入总分</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderClearingCard = () => (
    <section className="ams-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-ams-warning" />
        <h3 className="text-sm font-semibold text-ams-text-primary">清除测试（疼痛则对应动作记 0 分）</h3>
      </div>
      <div className="space-y-3">
        {CLEARING_TESTS.map((c) => {
          const pain = clearings[c.key] === false;
          return (
            <div key={c.key} className="flex items-start justify-between gap-3 rounded-ams border border-ams-border/60 bg-ams-background/40 p-3">
              <div>
                <div className="text-sm font-medium text-ams-text-primary">{c.name}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ams-text-muted">{c.desc}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setClear(c.key, false)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    !pain ? 'bg-ams-success/15 text-ams-success' : 'border border-ams-border text-ams-text-muted hover:border-ams-success/50'
                  }`}
                >
                  无疼痛
                </button>
                <button
                  type="button"
                  onClick={() => setClear(c.key, true)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    pain ? 'bg-ams-danger/15 text-ams-danger' : 'border border-ams-border text-ams-text-muted hover:border-ams-danger/50'
                  }`}
                >
                  有疼痛
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  // ---------- 渲染：结果区（单人） ----------
  const renderSingleResult = () => {
    if (!analysis) return null;
    return (
      <div className="space-y-6">
        {/* 操作条 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-ams-text-secondary">
            <Activity className="h-4 w-4 text-ams-primary" />
            筛查对象：<span className="font-medium text-ams-text-primary">{analysis.athleteName}</span>
            <span className="text-ams-text-muted">· {analysis.generatedAt}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyReport} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
              {copied ? <Check className="h-4 w-4 text-ams-success" /> : <Copy className="h-4 w-4" />}
              复制报告
            </button>
            <button type="button" onClick={downloadTXT} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
              <FileText className="h-4 w-4" />
              导出 TXT
            </button>
            <button type="button" onClick={exportPDF} disabled={exporting} className="inline-flex items-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              导出 PDF
            </button>
            <button type="button" onClick={resetAll} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
              <RotateCcw className="h-4 w-4" />
              重新评估
            </button>
          </div>
        </div>

        {/* 总分卡 + 风险 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="ams-card p-5">
            <div className="text-xs text-ams-text-muted">FMS 总分（0-21 分）</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-ams-primary">{analysis.total}</span>
              <span className="text-sm text-ams-text-muted">/ 21</span>
            </div>
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${riskCls[analysis.riskLevel]}`}>
                风险等级：{analysis.riskLevel}
              </span>
            </div>
          </div>
          <div className="ams-card p-5 md:col-span-2">
            <div className="text-xs text-ams-text-muted">评估结论</div>
            <p className="mt-2 text-sm leading-relaxed text-ams-text-secondary">{analysis.riskNote}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ams-text-secondary">
              <span className={analysis.asymmetricTests.length > 0 ? 'text-ams-warning' : 'text-ams-success'}>
                左右不对称：{analysis.asymmetricTests.length > 0 ? `${analysis.asymmetricTests.length} 项` : '无'}
              </span>
              <span className={analysis.painTests.length > 0 ? 'text-ams-danger' : 'text-ams-success'}>
                疼痛动作：{analysis.painTests.length > 0 ? analysis.painTests.join('、') : '无'}
              </span>
              <span className="text-ams-text-muted">风险阈值：≤ {RISK_THRESHOLD} 分（Kiesel et al. 2007）</span>
            </div>
          </div>
        </div>

        {/* 得分条形图 */}
        <section className="ams-card p-5">
          <div className="mb-3 text-sm font-semibold text-ams-text-primary">逐项得分对比</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${v} 分`, '得分']}
                  labelFormatter={(_, payload) => (payload && payload[0]?.payload?.full) || ''}
                />
                <ReferenceLine y={1} stroke="#FFB800" strokeDasharray="4 4" />
                <Bar dataKey="得分" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.asymmetric ? '#FFB800' : d['得分'] === 0 ? '#FF4D6D' : d['得分'] < 3 ? '#FF6B35' : '#00E5A0'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-ams-text-muted">
            琥珀色 = 存在左右不对称；珊瑚红 = 0 分（疼痛）；青绿 = 3 分（标准完成）；橙色 = 存在代偿（1-2 分）。虚线 = 1 分警戒线。
          </p>
        </section>

        {/* 明细 + 建议 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="ams-card p-5">
            <div className="mb-3 text-sm font-semibold text-ams-text-primary">逐项评分明细</div>
            <div className="space-y-2">
              {analysis.items.map((it) => (
                <div key={it.test.key} className="flex items-center justify-between rounded-ams border border-ams-border/50 bg-ams-background/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{it.test.icon}</span>
                    <span className="text-ams-text-primary">{it.test.name}</span>
                    {it.test.bilateral && (
                      <span className="text-xs text-ams-text-muted">左 {it.left} / 右 {it.right}</span>
                    )}
                    {it.asymmetric && (
                      <span className="rounded-full bg-ams-warning/15 px-2 py-0.5 text-xs text-ams-warning">不对称</span>
                    )}
                    {!it.cleared && (
                      <span className="rounded-full bg-ams-danger/15 px-2 py-0.5 text-xs text-ams-danger">清除疼痛</span>
                    )}
                  </div>
                  <span className={`text-base font-bold ${it.composite === 0 ? 'text-ams-danger' : it.composite < 3 ? 'text-ams-primary' : 'text-ams-success'}`}>
                    {it.composite}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="ams-card p-5">
            <div className="mb-3 text-sm font-semibold text-ams-text-primary">改进训练建议</div>
            <div className="space-y-2">
              {analysis.recommendations.map((r, i) => (
                <div key={i} className="flex gap-2 rounded-ams border border-ams-border/50 bg-ams-background/40 px-3 py-2 text-sm leading-relaxed text-ams-text-secondary">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ams-primary" />
                  {r}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 报告 */}
        <section className="ams-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">评估报告</h3>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-ams border border-ams-border bg-ams-background p-4 font-mono text-xs leading-relaxed text-ams-text-secondary">
            {reportText}
          </pre>
        </section>
      </div>
    );
  };

  // ---------- 渲染：批量模式 ----------
  const renderBatch = () => (
    <div className="space-y-6">
      <section className="ams-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Rows3 className="h-4 w-4 text-ams-primary" />
          <h3 className="text-sm font-semibold text-ams-text-primary">批量导入筛查数据</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">CSV 文本粘贴</label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'姓名,深蹲,跨栏左,跨栏右,弓步左,弓步右,肩部左,肩部右,直腿左,直腿右,俯卧撑,旋转左,旋转右,肩部清除,俯卧撑清除,旋转清除\n张三,2,2,3,2,2,1,1,3,3,2,2,2,1,1,1'}
              rows={6}
              className={`${inputCls} font-mono text-xs`}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => doParseCSV(csvText)}
                disabled={!csvText.trim() || parsing}
                className="inline-flex items-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Rows3 className="h-4 w-4" />
                解析数据
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary"
              >
                <FileSpreadsheet className="h-4 w-4" />
                下载模板
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">xlsx / csv 文件上传</label>
            <div className="flex h-[calc(100%-28px)] min-h-24 flex-col items-center justify-center rounded-ams border border-dashed border-ams-border bg-ams-background/40 p-4 text-center">
              <FileSpreadsheet className="mb-2 h-8 w-8 text-ams-primary/60" />
              <label className="cursor-pointer text-sm text-ams-primary hover:underline">
                选择文件上传
                <input
                  id="batch-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
              </label>
              <p className="mt-1 text-xs text-ams-text-muted">列顺序需与模板一致（16 列），清除列 0=疼痛 / 1=无痛</p>
            </div>
          </div>
        </div>
      </section>

      {batchResult && (
        <>
          {batchResult.errors.length > 0 && (
            <section className="ams-card border-ams-danger/40 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ams-danger">
                <AlertTriangle className="h-4 w-4" />
                部分数据未能解析（{batchResult.errors.length} 行）
              </div>
              <div className="max-h-40 space-y-1 overflow-auto text-xs text-ams-text-secondary">
                {batchResult.errors.map((e, i) => (
                  <div key={i}>
                    第 {e.row} 行「{e.name}」：{e.messages.join('；')}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 汇总统计 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="ams-card p-4">
              <div className="text-xs text-ams-text-muted">有效评估人数</div>
              <div className="mt-1 text-2xl font-bold text-ams-text-primary">{batchResult.validCount}</div>
            </div>
            <div className="ams-card p-4">
              <div className="text-xs text-ams-text-muted">低风险</div>
              <div className="mt-1 text-2xl font-bold text-ams-success">
                {batchResult.rows.filter((r) => r.analysis.riskLevel === '低').length}
              </div>
            </div>
            <div className="ams-card p-4">
              <div className="text-xs text-ams-text-muted">中风险</div>
              <div className="mt-1 text-2xl font-bold text-ams-warning">
                {batchResult.rows.filter((r) => r.analysis.riskLevel === '中').length}
              </div>
            </div>
            <div className="ams-card p-4">
              <div className="text-xs text-ams-text-muted">高风险</div>
              <div className="mt-1 text-2xl font-bold text-ams-danger">
                {batchResult.rows.filter((r) => r.analysis.riskLevel === '高').length}
              </div>
            </div>
          </div>

          {/* 结果表格 + 导出 */}
          <section className="ams-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-ams-primary" />
                <h3 className="text-sm font-semibold text-ams-text-primary">筛查结果明细</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadCSV} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                  导出 CSV
                </button>
                <button type="button" onClick={copyReport} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                  {copied ? <Check className="h-4 w-4 text-ams-success" /> : <Copy className="h-4 w-4" />}
                  复制汇总
                </button>
                <button type="button" onClick={downloadTXT} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                  <FileText className="h-4 w-4" />
                  导出 TXT
                </button>
                <button type="button" onClick={exportPDF} disabled={exporting} className="inline-flex items-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  导出 PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ams-table-header">
                    <th className="px-3 py-2 text-left">姓名</th>
                    {FMS_TESTS.map((t) => (
                      <th key={t.key} className="px-2 py-2 text-center" title={t.name}>
                        {t.short ?? t.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center">总分</th>
                    <th className="px-3 py-2 text-center">风险</th>
                    <th className="px-3 py-2 text-center">不对称</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.rows.map((r, i) => (
                    <tr key={i} className="border-t border-ams-border/50">
                      <td className="px-3 py-2 font-medium text-ams-text-primary">{r.name}</td>
                      {r.analysis.items.map((it) => (
                        <td
                          key={it.test.key}
                          className={`px-2 py-2 text-center ${
                            it.composite === 0 ? 'text-ams-danger' : it.composite < 3 ? 'text-ams-primary' : 'text-ams-success'
                          }`}
                          title={it.test.bilateral ? `左 ${it.left} / 右 ${it.right}` : undefined}
                        >
                          {it.composite}
                          {it.asymmetric && <span className="ml-0.5 text-ams-warning">⚠</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-bold text-ams-text-primary">{r.analysis.total}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskCls[r.analysis.riskLevel]}`}>
                          {r.analysis.riskLevel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-ams-text-secondary">
                        {r.analysis.asymmetricTests.length > 0 ? `${r.analysis.asymmetricTests.length} 项` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {batchResult.rows.length === 0 && (
              <p className="mt-3 text-center text-sm text-ams-text-muted">未解析到有效数据，请检查粘贴内容或文件格式</p>
            )}
          </section>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 模式切换 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ams-text-secondary">
          <Activity className="h-4 w-4 text-ams-primary" />
          FMS 功能性动作筛查（7 个基础动作 · 总分 21 分 · 循证风险阈值 ≤ {RISK_THRESHOLD}）
        </div>
        <div className="flex rounded-ams border border-ams-border p-0.5">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`inline-flex items-center gap-1.5 rounded-ams px-3 py-1.5 text-sm transition-colors ${
              mode === 'single' ? 'bg-ams-primary/15 font-medium text-ams-primary' : 'text-ams-text-secondary hover:text-ams-text-primary'
            }`}
          >
            <UserRound className="h-4 w-4" />
            单人筛查
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`inline-flex items-center gap-1.5 rounded-ams px-3 py-1.5 text-sm transition-colors ${
              mode === 'batch' ? 'bg-ams-primary/15 font-medium text-ams-primary' : 'text-ams-text-secondary hover:text-ams-text-primary'
            }`}
          >
            <Users className="h-4 w-4" />
            批量导入
          </button>
        </div>
      </div>

      {mode === 'single' ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* ============ 左：录入 ============ */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <section className="ams-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-ams-primary" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">筛查对象</h3>
                </div>
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
                </div>
              </section>
              {renderScoreCard()}
              {renderClearingCard()}
              <button
                type="button"
                onClick={() => setShowResult(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-ams bg-ams-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <ScanSearch className="h-4 w-4" />
                生成筛查结果
              </button>
            </div>

            {/* ============ 右：说明 ============ */}
            <div className="flex flex-col gap-6 lg:col-span-3">
              <section className="ams-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ams-primary" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">什么是 FMS 功能性动作筛查？</h3>
                </div>
                <p className="text-sm leading-relaxed text-ams-text-secondary">
                  FMS 由 Gray Cook 与 Lee Burton 提出，通过 7 个基础动作模式（深蹲、跨栏步、直线弓步蹲、肩部灵活性、主动直腿抬高、躯干稳定俯卧撑、旋转稳定性）
                  评估个体动作质量与功能局限。每动作按 0-3 分评分（3 标准完成 / 2 存在代偿 / 1 无法完成 / 0 出现疼痛），总分 21 分。
                  总分 ≤ {RISK_THRESHOLD} 分或存在左右不对称时，损伤风险显著增加（Kiesel et al. 2007），应优先进行动作质量重建。
                </p>
              </section>
              <section className="ams-card p-5">
                <div className="mb-3 text-sm font-semibold text-ams-text-primary">评分标准</div>
                <div className="space-y-2">
                  {[3, 2, 1, 0].map((s) => (
                    <div key={s} className="flex items-start gap-3 rounded-ams border border-ams-border/50 bg-ams-background/40 px-3 py-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          s === 0 ? 'bg-ams-danger/15 text-ams-danger' : s === 3 ? 'bg-ams-success/15 text-ams-success' : 'bg-ams-primary/15 text-ams-primary'
                        }`}
                      >
                        {s}
                      </span>
                      <span className="text-sm text-ams-text-secondary">{SCORE_LABELS[s]}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ams-text-muted">
                  单侧动作（跨栏步、直线弓步蹲、肩部灵活性、主动直腿抬高、旋转稳定性）左右分别评分，总分取左右较低分；左右差 ≥ 1 分记为不对称。
                  3 个清除测试出现疼痛时，对应动作（肩部灵活性 / 躯干稳定俯卧撑 / 旋转稳定性）强制记 0 分。
                </p>
              </section>
              <section className="ams-card p-5">
                <div className="mb-3 text-sm font-semibold text-ams-text-primary">测试流程建议</div>
                <ol className="space-y-2">
                  {[
                    '热身：10 分钟轻度活动（慢跑/自行车）+ 下肢动态拉伸，避免过度疲劳影响评分',
                    '按固定顺序依次完成 7 个动作，每动作讲解标准后由受试者执行 3 次，取最佳成绩',
                    '单侧动作先测右侧再测左侧（或先测惯用侧），由同一名测试员完成全部评分以保证一致性',
                    '发现疼痛立即停止该动作并记录 0 分，同步记录疼痛部位与动作阶段',
                    '如测试杆/测试板缺失，可用 PVC 管与地面划线替代，评分标准不变',
                  ].map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-ams-text-secondary">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ams-primary/15 text-xs font-medium text-ams-primary">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>

          {showResult && renderSingleResult()}
        </>
      ) : (
        renderBatch()
      )}
    </div>
  );
}
