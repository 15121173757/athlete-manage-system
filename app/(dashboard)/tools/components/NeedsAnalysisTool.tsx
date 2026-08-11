'use client';

/**
 * 运动科学工具箱 —— 运动需求分析（引导式 5 步评估流程）
 *
 * 步骤：1 运动员特点 → 2 专项分析 → 3 伤病风险 → 4 心理评估 → 5 其他维度
 * 输出：多维度评分、能力-需求雷达图、训练重点建议、结构化报告（复制 / TXT / PDF 导出）
 */

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserRound, Trophy, HeartPulse, Brain, Moon, ChevronLeft, ChevronRight,
  Check, FileText, Copy, Download, ClipboardCheck, RotateCcw, ExternalLink,
  Loader2, Activity,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend,
} from 'recharts';
import {
  FitnessAttr, FITNESS_ATTRS, SPORT_PROFILES, PSYCH_SCALES,
  AthleteProfileInput, InjuryRecord, InjuryStatus, LifestyleInput, Chronotype,
  analyzePhysical, analyzeSportMatch, analyzeInjury, analyzePsych, analyzeLifestyle,
  buildRecommendations, buildReport, buildReportSections, abilityLevel,
  NeedsAnalysisResult,
} from '@/lib/sport-science/needs-analysis';

const inputCls =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

interface Athlete {
  id: number;
  name: string;
  gender: string;
  height: string;
  weight: string;
  sport: string;
  birthDate: string;
}

/** 运动员档案中的项目名 → 需求档案 key */
const SPORT_KEY_BY_LABEL: Record<string, string> = {
  足球: 'football', 篮球: 'basketball', 排球: 'volleyball', 短跑: 'sprint',
  游泳: 'swimming', 网球: 'tennis', 举重: 'weightlifting',
};

const STEPS = [
  { key: 'physical', label: '运动员特点', desc: '身体成分与体能基础', icon: UserRound },
  { key: 'sport', label: '专项分析', desc: '项目需求与能力匹配', icon: Trophy },
  { key: 'injury', label: '伤病风险', desc: '损伤史与薄弱环节', icon: HeartPulse },
  { key: 'psych', label: '心理评估', desc: '韧性·动机·压力·比赛准备', icon: Brain },
  { key: 'lifestyle', label: '其他维度', desc: '睡眠·营养·生物节律', icon: Moon },
];

const DEFAULT_ABILITY: Record<FitnessAttr, number> = {
  strength: 50, speed: 50, power: 50, endurance: 50, agility: 50, flexibility: 50,
};
const DEFAULT_CUSTOM_DEMANDS: Record<FitnessAttr, number> = {
  strength: 50, speed: 50, power: 50, endurance: 50, agility: 50, flexibility: 50,
};

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

const INJURY_STATUS_OPTIONS: { value: InjuryStatus; label: string }[] = [
  { value: 'INJURED', label: '受伤中' },
  { value: 'RECOVERING', label: '康复中' },
  { value: 'RECOVERED', label: '已康复' },
];

const EMPTY_INJURY: InjuryRecord = {
  bodyPart: '', type: '', severity: 3, status: 'RECOVERED', recurrence: 0,
};

/** 数字输入辅助：空串保持 ''，否则转 number */
const num = (v: string): number | '' => (v === '' ? '' : Number(v));

export function NeedsAnalysisTool() {
  // ---------- 运动员（可选预填） ----------
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteName, setAthleteName] = useState('');

  // ---------- 引导流程状态 ----------
  const [step, setStep] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ---------- 步骤 1：运动员特点 ----------
  const [athlete, setAthlete] = useState<AthleteProfileInput>({
    name: '', gender: '', age: '', height: '', weight: '', bodyFat: '',
    trainingYears: '', weeklyFrequency: '', vo2max: '',
    ability: { ...DEFAULT_ABILITY },
  });

  // ---------- 步骤 2：专项分析 ----------
  const [sportKey, setSportKey] = useState('football');
  const [customDemands, setCustomDemands] = useState<Record<FitnessAttr, number>>({ ...DEFAULT_CUSTOM_DEMANDS });

  // ---------- 步骤 3：伤病风险 ----------
  const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
  const [draft, setDraft] = useState<InjuryRecord>({ ...EMPTY_INJURY });

  // ---------- 步骤 4：心理评估 ----------
  const [psychRatings, setPsychRatings] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(PSYCH_SCALES.map((s) => [s.key, s.items.map(() => 3)]))
  );

  // ---------- 步骤 5：其他维度 ----------
  const [life, setLife] = useState<LifestyleInput>({
    sleepHours: '', sleepQuality: 3, protein: 3, carbs: 3, hydration: 3,
    chronotype: 'intermediate', trainingTime: 'morning',
  });

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
    setAthlete((prev) => ({
      ...prev,
      name: a.name,
      gender: a.gender === 'FEMALE' ? 'FEMALE' : a.gender === 'MALE' ? 'MALE' : prev.gender,
      height: a.height ? Number(a.height) : prev.height,
      weight: a.weight ? Number(a.weight) : prev.weight,
      age: a.birthDate
        ? Math.max(10, Math.floor((Date.now() - new Date(a.birthDate).getTime()) / 31536000000))
        : prev.age,
    }));
    if (SPORT_KEY_BY_LABEL[a.sport]) setSportKey(SPORT_KEY_BY_LABEL[a.sport]);
  };

  const setAbility = (k: FitnessAttr, v: number) =>
    setAthlete((prev) => ({ ...prev, ability: { ...prev.ability, [k]: v } }));

  const setPsychScale = (key: string, idx: number, val: number) =>
    setPsychRatings((prev) => ({
      ...prev,
      [key]: prev[key].map((v, i) => (i === idx ? val : v)),
    }));

  // ---------- 计算 ----------
  const result = useMemo<NeedsAnalysisResult | null>(() => {
    if (!showResult) return null;
    const physical = analyzePhysical(athlete);
    const sportMatch = analyzeSportMatch(sportKey, athlete.ability, customDemands);
    const injury = analyzeInjury(injuries);
    const psych = analyzePsych(psychRatings);
    const lifestyle = analyzeLifestyle(life);
    const recommendations = buildRecommendations(physical, sportMatch, injury, psych, lifestyle);
    const r: NeedsAnalysisResult = {
      athleteName: athleteName || '未指定',
      generatedAt: new Date().toLocaleString('zh-CN'),
      physical, sportMatch, injury, psych, lifestyle, recommendations,
      reports: [],
    };
    r.reports = buildReportSections(r);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult, athlete, sportKey, customDemands, injuries, psychRatings, life, athleteName]);

  const reportText = useMemo(() => (result ? buildReport(result) : ''), [result]);

  // ---------- 导出 ----------
  const downloadTXT = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `needs-analysis-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const resp = await fetch('/api/sport-science/needs-analysis/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '运动需求分析报告',
          athleteName: result.athleteName,
          sportLabel: result.sportMatch.sportLabel,
          generatedAt: result.generatedAt,
          sections: result.reports,
        }),
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `needs-analysis-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF 导出失败，请重试或使用 TXT 导出');
    } finally {
      setExporting(false);
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
    } catch {
      // 剪贴板 API 不可用（如非 https / iframe 环境）时降级为 execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = reportText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        /* 两种方式均不可用时静默失败 */
      }
    }
    setTimeout(() => setCopied(false), 1500);
  };

  // ---------- 辅助渲染 ----------
  const profile = SPORT_PROFILES.find((p) => p.key === sportKey) ?? SPORT_PROFILES[0];
  const radarData = result
    ? result.sportMatch.radar.map((r) => ({
        attr: FITNESS_ATTRS.find((a) => a.key === r.attr)?.label ?? r.attr,
        专项需求: r.demand,
        运动员能力: r.ability,
      }))
    : [];

  const scoreCards = result
    ? [
        { label: '体能水平', value: result.physical.fitnessScore, desc: result.physical.fitnessDesc, cls: 'text-ams-primary' },
        { label: '专项匹配度', value: result.sportMatch.matchScore, desc: `需求-能力综合差距`, cls: 'text-ams-primary' },
        { label: '伤病风险', value: result.injury.riskScore, desc: `${result.injury.riskLevel}风险等级`, cls: 'text-ams-warning' },
        { label: '心理准备', value: result.psych.score, desc: `4 维度综合`, cls: 'text-ams-success' },
        {
          label: '生活状态', value: Math.round((result.lifestyle.sleepScore + result.lifestyle.nutritionScore + result.lifestyle.chronotypeScore) / 3),
          desc: '睡眠·营养·节律', cls: 'text-ams-success',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ============ 引导式步骤条 ============ */}
      <div className="rounded-ams border border-ams-border/60 bg-ams-background/40 p-3">
        <div className="flex flex-wrap items-center gap-y-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const reached = showResult || step > i + 1;
            const current = step === i + 1 && !showResult;
            return (
              <div key={s.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => (reached || current) && !showResult && setStep(i + 1)}
                  className={`flex items-center gap-2 rounded-ams px-3 py-2 transition-colors ${
                    current
                      ? 'bg-ams-primary/10 text-ams-primary'
                      : reached
                        ? 'text-ams-text-secondary hover:bg-ams-surface-hover'
                        : 'cursor-default text-ams-text-muted/70'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      current
                        ? 'bg-ams-primary text-white'
                        : reached
                          ? 'bg-ams-success/20 text-ams-success'
                          : 'bg-ams-border/40 text-ams-text-muted'
                    }`}
                  >
                    {reached ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className={`text-sm font-medium ${current ? 'text-ams-primary' : reached ? '' : 'text-ams-text-muted/70'}`}>
                    {i + 1} · {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="mx-1 hidden h-px w-6 bg-ams-border sm:block md:w-10" />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ams-text-muted">
          按顺序完成 5 个维度评估（已完成的步骤可点击回看），最后一步点击「生成分析报告」输出结果。
        </p>
      </div>

      {showResult && result ? (
        /* ================== 结果区 ================== */
        <div className="space-y-6">
          {/* 操作条 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-ams-text-secondary">
              <ClipboardCheck className="h-4 w-4 text-ams-primary" />
              分析对象：<span className="font-medium text-ams-text-primary">{result.athleteName}</span>
              <span className="text-ams-text-muted">· {result.sportMatch.sportLabel} · {result.generatedAt}</span>
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
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? '生成中…' : '导出 PDF'}
              </button>
              <button type="button" onClick={() => { setShowResult(false); setStep(1); }} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary">
                <RotateCcw className="h-4 w-4" />
                重新分析
              </button>
            </div>
          </div>

          {/* 综合评分卡 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {scoreCards.map((c) => (
              <div key={c.label} className="ams-card p-4">
                <div className="text-xs text-ams-text-secondary">{c.label}</div>
                <div className={`mt-1 text-2xl font-bold ${c.cls}`}>{c.value}<span className="text-sm font-normal text-ams-text-muted">/100</span></div>
                <div className="mt-1 text-xs text-ams-text-muted">{c.desc}</div>
              </div>
            ))}
          </div>

          {/* 雷达图 + 专项详情 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <section className="ams-card p-5 lg:col-span-3">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-ams-primary" />
                <h3 className="text-sm font-semibold text-ams-text-primary">身体素质能力 vs 专项需求</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="#2B4A6B" />
                    <PolarAngleAxis dataKey="attr" tick={{ fill: '#8FA8C0', fontSize: 12 }} />
                    <Radar name="专项需求" dataKey="专项需求" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.18} strokeWidth={2} />
                    <Radar name="运动员能力" dataKey="运动员能力" stroke="#38BDF8" fill="#38BDF8" fillOpacity={0.22} strokeWidth={2} />
                    <Legend content={renderLegend} verticalAlign="bottom" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-ams-text-muted">
                橙色=专项需求画像，蓝色=运动员当前能力。能力明显低于需求的维度即为训练优先项。
              </p>
            </section>

            <section className="space-y-4 lg:col-span-2">
              <div className="ams-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-ams-primary" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">{result.sportMatch.sportLabel} · 专项需求画像</h3>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-ams-text-muted">代谢特征</dt>
                    <dd className="text-ams-text-secondary">{result.sportMatch.profile.meta}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ams-text-muted">能量系统贡献</dt>
                    <dd className="text-ams-text-secondary">
                      有氧 {result.sportMatch.profile.energy.aerobic}% / 无氧 {result.sportMatch.profile.energy.anaerobic}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ams-text-muted">技术动作模式</dt>
                    <dd className="text-ams-text-secondary">{result.sportMatch.profile.techModes.join('、')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ams-text-muted">比赛与周期特点</dt>
                    <dd className="text-ams-text-secondary">{result.sportMatch.profile.competition}</dd>
                  </div>
                </dl>
              </div>

              {/* 缺口明细 */}
              <div className="ams-card p-5">
                <h4 className="mb-2 text-sm font-semibold text-ams-text-primary">主要不足项（训练优先）</h4>
                {result.sportMatch.gaps.length ? (
                  <ul className="space-y-1.5">
                    {result.sportMatch.gaps.map((g) => (
                      <li key={g.attr} className="flex items-center justify-between rounded-ams bg-ams-warning/10 px-3 py-1.5 text-sm">
                        <span className="text-ams-text-primary">{FITNESS_ATTRS.find((a) => a.key === g.attr)?.label}</span>
                        <span className="text-xs text-ams-text-secondary">
                          需求 {g.demand} vs 能力 {g.ability} <span className="font-medium text-ams-warning">缺 {Math.abs(g.diff)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ams-text-muted">各项身体素质与专项需求匹配良好，无显著缺口。</p>
                )}
                {result.sportMatch.strengths.length > 0 && (
                  <p className="mt-2 text-xs text-ams-text-muted">
                    相对优势：{result.sportMatch.strengths.map((s) => FITNESS_ATTRS.find((a) => a.key === s.attr)?.label).join('、')}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* 维度明细 + 建议 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 伤病 */}
            <section className="ams-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-ams-warning" />
                <h3 className="text-sm font-semibold text-ams-text-primary">伤病风险与历史</h3>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeCls(result.injury.riskLevel)}`}>
                  {result.injury.riskLevel}风险 {result.injury.riskScore}/100
                </span>
              </div>
              <ul className="space-y-1 text-sm text-ams-text-secondary">
                {result.injury.notes.map((n, i) => <li key={i}>· {n}</li>)}
              </ul>
              {result.injury.weakLinks.length > 0 && (
                <p className="mt-2 text-xs text-ams-warning">薄弱环节：{result.injury.weakLinks.join('、')}</p>
              )}
            </section>

            {/* 心理 */}
            <section className="ams-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4 text-ams-success" />
                <h3 className="text-sm font-semibold text-ams-text-primary">心理状态评估</h3>
                <span className="ml-auto text-sm font-semibold text-ams-success">{result.psych.score}/100</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {result.psych.perScale.map((p) => (
                  <div key={p.key} className="rounded-ams bg-ams-background/60 px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ams-text-secondary">{p.label}</span>
                      <span className="font-medium text-ams-text-primary">{p.score}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ams-border/50">
                      <div className="h-full rounded-full bg-ams-success/70" style={{ width: `${p.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-ams-text-secondary">
                {result.psych.notes.map((n, i) => <li key={i}>· {n}</li>)}
              </ul>
            </section>

            {/* 其他维度 */}
            <section className="ams-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Moon className="h-4 w-4 text-ams-primary" />
                <h3 className="text-sm font-semibold text-ams-text-primary">睡眠 · 营养 · 生物节律</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '睡眠', v: result.lifestyle.sleepScore },
                  { label: '营养', v: result.lifestyle.nutritionScore },
                  { label: '节律匹配', v: result.lifestyle.chronotypeScore },
                ].map((x) => (
                  <div key={x.label} className="rounded-ams bg-ams-background/60 px-3 py-2 text-center">
                    <div className="text-xs text-ams-text-muted">{x.label}</div>
                    <div className="text-lg font-bold text-ams-primary">{x.v}</div>
                  </div>
                ))}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-ams-text-secondary">
                {result.lifestyle.notes.map((n, i) => <li key={i}>· {n}</li>)}
              </ul>
            </section>

            {/* 建议 */}
            <section className="ams-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ams-text-primary">训练重点与建议</h3>
                <Link href="/training/plans/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary !py-1 text-xs">
                  制定训练计划 <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ol className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priorityCls(rec.priority)}`}>
                      {rec.priority}
                    </span>
                    <span className="text-ams-text-secondary"><span className="font-medium text-ams-text-primary">[{rec.category}]</span> {rec.text}</span>
                  </li>
                ))}
                {result.recommendations.length === 0 && (
                  <li className="text-sm text-ams-text-muted">当前各维度评估结果良好，维持现有训练结构。</li>
                )}
              </ol>
            </section>
          </div>

          {/* 报告预览 */}
          <section className="ams-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-ams-primary" />
              <h3 className="text-sm font-semibold text-ams-text-primary">分析报告预览</h3>
              <span className="ml-auto text-xs text-ams-text-muted">支持复制 / TXT / PDF 导出，便于存档分享</span>
            </div>
            <pre className="ams-scrollbar max-h-96 overflow-auto whitespace-pre-wrap rounded-ams border border-ams-border bg-ams-background p-4 font-mono text-xs leading-relaxed text-ams-text-secondary">
              {reportText}
            </pre>
          </section>
        </div>
      ) : (
        /* ================== 表单流程 ================== */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* 左：当前步骤表单 */}
          <div className="lg:col-span-3">
            {/* ---------- 步骤 1：运动员特点 ---------- */}
            {step === 1 && (
              <section className="ams-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-ams-primary" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">运动员个人特点</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">选择运动员（可选，自动预填基础信息）</label>
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">性别</label>
                      <select value={athlete.gender} onChange={(e) => setAthlete({ ...athlete, gender: e.target.value as AthleteProfileInput['gender'] })} className={inputCls}>
                        <option value="">—</option>
                        <option value="MALE">男</option>
                        <option value="FEMALE">女</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">年龄（岁）</label>
                      <input type="number" min={10} max={60} value={athlete.age} onChange={(e) => setAthlete({ ...athlete, age: num(e.target.value) })} placeholder="如：22" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">身高（cm）</label>
                      <input type="number" min={100} max={230} value={athlete.height} onChange={(e) => setAthlete({ ...athlete, height: num(e.target.value) })} placeholder="如：180" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">体重（kg）</label>
                      <input type="number" min={30} max={200} value={athlete.weight} onChange={(e) => setAthlete({ ...athlete, weight: num(e.target.value) })} placeholder="如：75" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">体脂率（%）</label>
                      <input type="number" min={3} max={45} step="0.1" value={athlete.bodyFat} onChange={(e) => setAthlete({ ...athlete, bodyFat: num(e.target.value) })} placeholder="可选" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">训练年限（年）</label>
                      <input type="number" min={0} max={40} value={athlete.trainingYears} onChange={(e) => setAthlete({ ...athlete, trainingYears: num(e.target.value) })} placeholder="如：5" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">周训练频率（次/周）</label>
                      <input type="number" min={1} max={14} value={athlete.weeklyFrequency} onChange={(e) => setAthlete({ ...athlete, weeklyFrequency: num(e.target.value) })} placeholder="如：6" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">VO₂max（mL/kg/min）</label>
                      <input type="number" min={20} max={90} value={athlete.vo2max} onChange={(e) => setAthlete({ ...athlete, vo2max: num(e.target.value) })} placeholder="可选" className={inputCls} />
                    </div>
                  </div>
                  <p className="text-xs text-ams-text-muted">
                    身体成分与体能基础用于评估运动员的个人特点与训练成熟度；已填项目越多，分析越完整。
                  </p>
                </div>
              </section>
            )}

            {/* ---------- 步骤 2：专项分析 ---------- */}
            {step === 2 && (
              <section className="ams-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-ams-primary" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">专项运动项目分析</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">运动专项</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SPORT_PROFILES.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSportKey(p.key)}
                          className={`rounded-ams border px-3 py-2 text-sm transition-colors ${
                            sportKey === p.key
                              ? 'border-ams-primary bg-ams-primary/10 font-medium text-ams-primary'
                              : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3 text-sm">
                    <p className="mb-1 font-medium text-ams-text-primary">{profile.label} · 需求画像</p>
                    <p className="text-ams-text-secondary">{profile.meta}</p>
                    <p className="mt-1 text-xs text-ams-text-muted">
                      能量系统：有氧 {profile.energy.aerobic}% / 无氧 {profile.energy.anaerobic}% · 动作模式：{profile.techModes.join('、')}
                    </p>
                  </div>

                  {sportKey === 'custom' && (
                    <div className="rounded-ams border border-ams-warning/30 bg-ams-warning/5 p-3">
                      <p className="mb-2 text-sm font-medium text-ams-warning">自定义项目：请按实际需求设定各素质权重</p>
                      <div className="space-y-2">
                        {FITNESS_ATTRS.map((a) => (
                          <div key={a.key} className="flex items-center gap-3">
                            <span className="w-16 shrink-0 text-sm text-ams-text-secondary">{a.label}</span>
                            <input type="range" min={0} max={100} step={5} value={customDemands[a.key]}
                              onChange={(e) => setCustomDemands({ ...customDemands, [a.key]: Number(e.target.value) })}
                              className="w-full accent-ams-primary" />
                            <span className="w-10 text-right text-sm text-ams-text-primary">{customDemands[a.key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ams-text-primary">身体素质能力自评（0-100）</label>
                    <div className="space-y-2.5">
                      {FITNESS_ATTRS.map((a) => {
                        const v = athlete.ability[a.key];
                        const lv = abilityLevel(v);
                        return (
                          <div key={a.key} className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-2.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-ams-text-primary">{a.label}</span>
                              <span className={`text-xs ${lv.cls}`}>{lv.label} · {v}</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-3">
                              <input type="range" min={0} max={100} step={5} value={v}
                                onChange={(e) => setAbility(a.key, Number(e.target.value))}
                                className="w-full accent-ams-primary" />
                              <span className="w-12 text-right text-xs text-ams-text-muted">{a.desc}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-ams-text-muted">
                      参考：&lt;40 薄弱 / 40-54 较差 / 55-69 中等 / 70-84 良好 / ≥85 优秀。系统将能力与专项需求画像对比，输出匹配度与训练缺口。
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ---------- 步骤 3：伤病风险 ---------- */}
            {step === 3 && (
              <section className="ams-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-ams-warning" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">伤病风险与历史分析</h3>
                </div>
                <div className="space-y-4">
                  <div className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-3">
                    <div className="mb-2 text-sm font-medium text-ams-text-primary">添加伤病记录</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <input value={draft.bodyPart} onChange={(e) => setDraft({ ...draft, bodyPart: e.target.value })} placeholder="部位，如：右膝" className={inputCls} />
                      <input value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} placeholder="类型，如：前交叉韧带损伤" className={inputCls} />
                      <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: Number(e.target.value) })} className={inputCls}>
                        {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>严重度 {s}/5</option>)}
                      </select>
                      <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as InjuryStatus })} className={inputCls}>
                        {INJURY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <div className="flex items-center gap-2">
                        <select value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: Number(e.target.value) })} className={inputCls}>
                          {[0, 1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>复发 {r} 次</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={!draft.bodyPart.trim() || !draft.type.trim()}
                          onClick={() => { setInjuries([...injuries, { ...draft, bodyPart: draft.bodyPart.trim(), type: draft.type.trim() }]); setDraft({ ...EMPTY_INJURY }); }}
                          className="shrink-0 rounded-ams bg-ams-primary px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          添加
                        </button>
                      </div>
                    </div>
                  </div>

                  {injuries.length ? (
                    <div className="overflow-hidden rounded-ams border border-ams-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="ams-table-header">
                            <th className="px-3 py-2 text-left">部位</th>
                            <th className="px-3 py-2 text-left">类型</th>
                            <th className="px-3 py-2 text-left">严重度</th>
                            <th className="px-3 py-2 text-left">状态</th>
                            <th className="px-3 py-2 text-left">复发</th>
                            <th className="w-12 px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {injuries.map((inj, i) => (
                            <tr key={i} className="border-t border-ams-border/50">
                              <td className="px-3 py-2">{inj.bodyPart}</td>
                              <td className="px-3 py-2 text-ams-text-secondary">{inj.type}</td>
                              <td className="px-3 py-2">{inj.severity}/5</td>
                              <td className="px-3 py-2 text-xs">{INJURY_STATUS_OPTIONS.find((o) => o.value === inj.status)?.label}</td>
                              <td className="px-3 py-2">{inj.recurrence} 次</td>
                              <td className="px-2 py-2">
                                <button type="button" onClick={() => setInjuries(injuries.filter((_, j) => j !== i))} className="text-xs text-ams-danger hover:underline">删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-ams-text-muted">暂无伤病记录，将按低风险评估（可跳过本步）。</p>
                  )}
                  <p className="text-xs text-ams-text-muted">
                    风险模型：累积风险 = Σ（严重度 × 6 + 复发 × 8）+ 康复中 +12 / 受伤中 +20，30 分以下低风险、30-60 中风险、60 以上高风险。
                  </p>
                </div>
              </section>
            )}

            {/* ---------- 步骤 4：心理评估 ---------- */}
            {step === 4 && (
              <section className="ams-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-ams-success" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">心理状态评估</h3>
                </div>
                <p className="mb-4 text-xs text-ams-text-muted">
                  基于标准化心理量表（心理韧性参考 CD-RISC 概念、动机基于自我决定理论），每题按 1-5 评分（1 非常不符合 → 5 非常符合）。
                </p>
                <div className="space-y-4">
                  {PSYCH_SCALES.map((scale) => (
                    <div key={scale.key} className="rounded-ams border border-ams-border/50 bg-ams-background/40 p-3">
                      <div className="mb-2 text-sm font-medium text-ams-text-primary">{scale.label}</div>
                      <div className="space-y-2">
                        {scale.items.map((item, idx) => (
                          <div key={idx} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm text-ams-text-secondary">{item}</span>
                            <div className="flex shrink-0 items-center gap-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setPsychScale(scale.key, idx, n)}
                                  className={`h-7 w-7 rounded-full text-xs transition-colors ${
                                    psychRatings[scale.key]?.[idx] === n
                                      ? 'bg-ams-primary font-medium text-white'
                                      : 'bg-ams-border/30 text-ams-text-secondary hover:bg-ams-border/60'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ---------- 步骤 5：其他维度 ---------- */}
            {step === 5 && (
              <section className="ams-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Moon className="h-4 w-4 text-ams-primary" />
                  <h3 className="text-sm font-semibold text-ams-text-primary">睡眠 · 营养 · 生物节律</h3>
                </div>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">平均睡眠时长（小时/晚）</label>
                      <input type="number" min={3} max={12} step="0.5" value={life.sleepHours} onChange={(e) => setLife({ ...life, sleepHours: num(e.target.value) })} placeholder="如：7.5" className={inputCls} />
                      <p className="mt-1 text-xs text-ams-text-muted">睡眠基金会推荐 7-9 小时</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">睡眠质量自评</label>
                      <select value={life.sleepQuality} onChange={(e) => setLife({ ...life, sleepQuality: Number(e.target.value) })} className={inputCls}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5（{n <= 2 ? '差' : n === 3 ? '一般' : n === 4 ? '良好' : '很好'}）</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">蛋白质摄入充足性</label>
                      <select value={life.protein} onChange={(e) => setLife({ ...life, protein: Number(e.target.value) })} className={inputCls}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">碳水摄入充足性</label>
                      <select value={life.carbs} onChange={(e) => setLife({ ...life, carbs: Number(e.target.value) })} className={inputCls}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">水合状态</label>
                      <select value={life.hydration} onChange={(e) => setLife({ ...life, hydration: Number(e.target.value) })} className={inputCls}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">生物节律类型</label>
                      <select value={life.chronotype} onChange={(e) => setLife({ ...life, chronotype: e.target.value as Chronotype })} className={inputCls}>
                        <option value="morning">晨型（早睡早起，上午状态最佳）</option>
                        <option value="intermediate">中间型</option>
                        <option value="evening">晚型（晚间状态最佳）</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">倾向训练时段</label>
                      <select value={life.trainingTime} onChange={(e) => setLife({ ...life, trainingTime: e.target.value as LifestyleInput['trainingTime'] })} className={inputCls}>
                        <option value="morning">上午</option>
                        <option value="afternoon">下午</option>
                        <option value="evening">晚间</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-ams-text-muted">
                    睡眠、营养与生物节律是影响训练适应与伤病风险的关键恢复因素（参考运动营养与睡眠科学前沿研究）。
                  </p>
                </div>
              </section>
            )}

            {/* 步骤导航 */}
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="inline-flex items-center gap-2 rounded-ams border border-ams-border/60 bg-ams-surface px-3 py-2 text-sm text-ams-text-secondary transition-colors hover:border-ams-primary/50 hover:text-ams-text-primary disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> 上一步
              </button>
              {step < 5 ? (
                <button type="button" onClick={() => setStep(step + 1)} className="inline-flex items-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  下一步 <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={() => setShowResult(true)} className="inline-flex items-center gap-2 rounded-ams bg-ams-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  <ClipboardCheck className="h-4 w-4" /> 生成分析报告
                </button>
              )}
            </div>
          </div>

          {/* 右：当前步骤说明 */}
          <div className="space-y-4 lg:col-span-2">
            <div className="ams-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">当前步骤：{STEPS[step - 1].label}</h3>
              <div className="flex items-start gap-3">
                {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ams-primary" />; })()}
                <div>
                  <p className="text-sm text-ams-text-secondary">{stepDesc(step)}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-ams-text-muted">
                    {stepTips(step).map((t, i) => <li key={i} className="flex items-start gap-1.5">· {t}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="ams-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-ams-text-primary">分析框架</h3>
              <p className="text-xs leading-relaxed text-ams-text-secondary">
                本工具基于 Bompa &amp; Haff《Periodization》的专项需求分析（Needs Analysis）框架，结合
                各专项运动生理学需求画像、伤病流行病学风险因素与运动心理/睡眠/营养科学证据，
                从 5 个维度生成标准化评估报告，为制定个性化体能训练计划提供量化依据。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ 步骤说明辅助 ============ */

function stepDesc(step: number): string {
  switch (step) {
    case 1: return '收集基本生理指标、身体成分与训练背景，评估训练适应能力与体能基础。';
    case 2: return '选择运动专项，将运动员身体素质能力与专项需求画像进行匹配分析。';
    case 3: return '建立伤病档案，按严重度与复发情况量化风险，识别当前薄弱环节。';
    case 4: return '通过标准化量表评估心理韧性、动机、压力应对与比赛心理准备。';
    case 5: return '评估睡眠、营养与生物节律等影响运动表现的关键恢复因素。';
    default: return '';
  }
}

function stepTips(step: number): string[] {
  switch (step) {
    case 1: return ['选择运动员可自动预填基础信息', '体脂率与 VO₂max 为选填项，填写越完整分析越准确', '体能水平综合训练年限、周频率与有氧能力评估'];
    case 2: return ['内置 7 个常见专项需求画像，可自定义项目权重', '能力自评请基于近 1 个月实际表现', '系统将输出匹配度与训练缺口清单'];
    case 3: return ['严重度 1-5：1 轻度拉伤 → 5 重大手术', '复发性损伤显著提高风险评分', '受伤中/康复中的部位将标记为薄弱环节'];
    case 4: return ['每题 1-5 分，可由教练观察评估或运动员自评', '心理韧性参考 CD-RISC 简版概念', '评分低于 60 的维度会进入训练建议'];
    case 5: return ['睡眠时长建议 7-9 小时', '营养按 1-5 自评充足性', '训练时段与生物节律错配会触发调整建议'];
    default: return [];
  }
}

function riskBadgeCls(level: string): string {
  if (level === '高') return 'bg-ams-danger/15 text-ams-danger';
  if (level === '中') return 'bg-ams-warning/15 text-ams-warning';
  return 'bg-ams-success/15 text-ams-success';
}

function priorityCls(p: string): string {
  if (p === '高') return 'bg-ams-danger/15 text-ams-danger';
  if (p === '中') return 'bg-ams-warning/15 text-ams-warning';
  return 'bg-ams-success/15 text-ams-success';
}
