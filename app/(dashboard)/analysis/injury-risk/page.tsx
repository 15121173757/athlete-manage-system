/**
 * 伤病风险预警页 —— /analysis/injury-risk
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertTriangle, TrendingDown, Lightbulb, RefreshCw, Download, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Athlete {
  id: number;
  name: string;
  sport: string;
  status: string;
}

interface RiskSummary {
  athleteId: number;
  athleteName: string;
  riskLevel: string;
  riskScore: number;
}

interface RiskHistoryPoint {
  id: number;
  riskLevel: string;
  riskScore: number;
  weeksRange: number;
  createdAt: string;
}

interface RiskResult {
  riskLevel: string;
  riskScore: number;
  riskFactors: string;
  warningSignals: string;
  preventionAdvice: string;
  trainingAdjustment: string;
  rawContent: string;
  provider: string;
  reportId?: number;
}

const riskColors: Record<string, string> = {
  '低风险': 'text-ams-success bg-ams-success/10',
  '中风险': 'text-ams-warning bg-ams-warning/10',
  '高风险': 'text-ams-danger bg-ams-danger/10',
};

export default function InjuryRiskPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [summaries, setSummaries] = useState<RiskSummary[]>([]);
  const [history, setHistory] = useState<RiskHistoryPoint[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [weeksRange, setWeeksRange] = useState(4);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const fetchAthletes = useCallback(async () => {
    try {
      const res = await fetch('/api/athletes?pageSize=100');
      const json = await res.json();
      if (json.success) setAthletes(json.data.athletes);
    } catch { /* empty */ }
  }, []);

  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const res = await fetch('/api/llm/injury-risk');
      const json = await res.json();
      if (json.success) setSummaries(json.data || []);
    } catch { /* empty */ }
    finally { setIsLoadingSummary(false); }
  }, []);

  const fetchHistory = useCallback(async (athleteId: number) => {
    try {
      const res = await fetch(`/api/llm/injury-risk?athleteId=${athleteId}`);
      const json = await res.json();
      if (json.success) setHistory(json.data || []);
    } catch { /* empty */ }
  }, []);

  useEffect(() => {
    fetchAthletes();
    fetchSummary();
  }, [fetchAthletes, fetchSummary]);

  useEffect(() => {
    if (selectedId) {
      fetchHistory(selectedId);
    } else {
      setHistory([]);
    }
  }, [selectedId, fetchHistory]);

  const handleAnalyze = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/llm/injury-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId: selectedId, weeksRange }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        fetchHistory(selectedId);
      } else {
        alert(json.error?.message || '分析失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!result?.reportId) return;
    window.open(`/api/llm/injury-risk/export?reportId=${result.reportId}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">伤病风险预警</h2>
        <Button variant="outline" onClick={fetchSummary} disabled={isLoadingSummary}>
          <RefreshCw className={`h-4 w-4 ${isLoadingSummary ? 'animate-spin' : ''}`} />
          刷新概览
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：全队风险概览 */}
        <div className="ams-card p-4 lg:col-span-1">
          <h3 className="mb-3 text-sm font-medium text-ams-text-primary">全队风险概览</h3>
          {isLoadingSummary ? (
            <div className="py-8 text-center text-ams-text-secondary">加载中...</div>
          ) : summaries.length === 0 ? (
            <div className="py-8 text-center text-ams-text-secondary">暂无数据</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {summaries.map((s) => {
                const colorClass = riskColors[s.riskLevel] || 'text-ams-text-secondary bg-ams-surface-hover';
                return (
                  <button
                    key={s.athleteId}
                    onClick={() => setSelectedId(s.athleteId)}
                    className={`w-full rounded-ams px-3 py-2 text-left transition-colors ${
                      selectedId === s.athleteId
                        ? 'bg-ams-primary/10 ring-1 ring-ams-primary/30'
                        : 'hover:bg-ams-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ams-text-primary">{s.athleteName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                        {s.riskLevel}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-ams-border">
                        <div
                          className={`h-1.5 rounded-full ${
                            s.riskScore >= 40 ? 'bg-ams-danger' : s.riskScore >= 20 ? 'bg-ams-warning' : 'bg-ams-success'
                          }`}
                          style={{ width: `${Math.min(s.riskScore, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-ams-text-muted">{s.riskScore}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧：风险分析报告 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 分析控制 */}
          <div className="ams-card p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm text-ams-text-secondary">选择运动员</label>
                <select
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
                >
                  <option value="">请选择</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}（{a.sport}）</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-ams-text-secondary">分析周期</label>
                <select
                  value={weeksRange}
                  onChange={(e) => setWeeksRange(parseInt(e.target.value))}
                  className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                >
                  <option value={2}>近 2 周</option>
                  <option value={4}>近 4 周</option>
                  <option value={8}>近 8 周</option>
                </select>
              </div>
              <Button onClick={handleAnalyze} disabled={!selectedId || isLoading}>
                <ShieldAlert className="h-4 w-4" />
                {isLoading ? '分析中...' : '风险分析'}
              </Button>
            </div>
          </div>

          {/* 风险历史趋势图 */}
          {selectedId && history.length > 0 && (
            <div className="ams-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-ams-primary" />
                <h3 className="text-base font-semibold text-ams-text-primary">风险评分趋势</h3>
                <span className="text-xs text-ams-text-muted">（最近 {history.length} 次分析）</span>
              </div>
              <RiskTrendChart history={history} />
            </div>
          )}

          {/* 分析结果 */}
          {isLoading && (
            <div className="ams-card flex h-64 items-center justify-center">
              <div className="text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-ams-primary" />
                <p className="mt-2 text-sm text-ams-text-secondary">正在分析风险数据...</p>
              </div>
            </div>
          )}

          {!isLoading && !result && (
            <div className="ams-card flex h-64 items-center justify-center">
              <div className="text-center text-ams-text-secondary">
                <ShieldAlert className="mx-auto h-12 w-12 text-ams-text-muted" />
                <p className="mt-2">选择运动员后点击「风险分析」生成预警报告</p>
              </div>
            </div>
          )}

          {result && !isLoading && (
            <>
              {/* 风险等级 + 导出 */}
              <div className="ams-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full px-4 py-1 text-lg font-bold ${
                      result.riskLevel.includes('高') ? 'bg-ams-danger/10 text-ams-danger' :
                      result.riskLevel.includes('中') ? 'bg-ams-warning/10 text-ams-warning' :
                      'bg-ams-success/10 text-ams-success'
                    }`}>
                      {result.riskLevel}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ams-text-muted">评分</span>
                      <span className="text-lg font-bold text-ams-text-primary">{result.riskScore}</span>
                      <span className="text-xs text-ams-text-muted">/ 100</span>
                    </div>
                    <span className="text-xs text-ams-text-muted">由 {result.provider} 生成</span>
                  </div>
                  {result.reportId && (
                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                      <Download className="h-4 w-4" />
                      导出 PDF
                    </Button>
                  )}
                </div>
              </div>

              {/* 风险因素 */}
              {result.riskFactors && (
                <div className="ams-card p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-ams-warning" />
                    <h3 className="text-base font-semibold text-ams-text-primary">风险因素</h3>
                  </div>
                  <div className="space-y-2 text-sm text-ams-text-secondary whitespace-pre-wrap">
                    {result.riskFactors}
                  </div>
                </div>
              )}

              {/* 预警信号 */}
              {result.warningSignals && (
                <div className="ams-card p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-ams-danger" />
                    <h3 className="text-base font-semibold text-ams-text-primary">预警信号</h3>
                  </div>
                  <div className="space-y-2 text-sm text-ams-text-secondary whitespace-pre-wrap">
                    {result.warningSignals}
                  </div>
                </div>
              )}

              {/* 预防建议 */}
              {result.preventionAdvice && (
                <div className="ams-card p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-ams-primary" />
                    <h3 className="text-base font-semibold text-ams-text-primary">预防建议</h3>
                  </div>
                  <div className="space-y-2 text-sm text-ams-text-secondary whitespace-pre-wrap">
                    {result.preventionAdvice}
                  </div>
                </div>
              )}

              {/* 训练调整建议 */}
              {result.trainingAdjustment && (
                <div className="ams-card p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-ams-success" />
                    <h3 className="text-base font-semibold text-ams-text-primary">训练调整建议</h3>
                  </div>
                  <div className="space-y-2 text-sm text-ams-text-secondary whitespace-pre-wrap">
                    {result.trainingAdjustment}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 风险趋势图（SVG 实现，无需外部库）
// ============================================================

function RiskTrendChart({ history }: { history: RiskHistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="py-6 text-center text-sm text-ams-text-muted">
        至少需要 2 次分析才能显示趋势
      </div>
    );
  }

  // 按时间正序排列（旧 -> 新）
  const points = [...history].reverse();
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxScore = 100;
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : 0;

  // 计算坐标点
  const coords = points.map((p, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - (p.riskScore / maxScore) * chartHeight,
    point: p,
  }));

  // 折线路径
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  // Y 轴刻度（0, 20, 40, 60, 80, 100）
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full" style={{ minWidth: width }}>
        {/* Y 轴刻度线 */}
        {yTicks.map((tick) => {
          const y = padding.top + chartHeight - (tick / maxScore) * chartHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-ams-border"
                strokeDasharray={tick === 0 ? 'none' : '2 4'}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-ams-text-muted text-[10px]"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* 风险区域背景 */}
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight * 0.4}
          fill="currentColor"
          className="text-ams-success/5"
        />
        <rect
          x={padding.left}
          y={padding.top + chartHeight * 0.4}
          width={chartWidth}
          height={chartHeight * 0.2}
          fill="currentColor"
          className="text-ams-warning/5"
        />
        <rect
          x={padding.left}
          y={padding.top + chartHeight * 0.6}
          width={chartWidth}
          height={chartHeight * 0.4}
          fill="currentColor"
          className="text-ams-danger/5"
        />

        {/* 折线 */}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-ams-primary"
        />

        {/* 数据点 */}
        {coords.map((c, i) => {
          const color = c.point.riskScore >= 40 ? 'text-ams-danger' : c.point.riskScore >= 20 ? 'text-ams-warning' : 'text-ams-success';
          return (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r="4"
                fill="currentColor"
                className={color}
              />
              <text
                x={c.x}
                y={c.y - 8}
                textAnchor="middle"
                className="fill-ams-text-primary text-[10px] font-medium"
              >
                {c.point.riskScore}
              </text>
              <text
                x={c.x}
                y={height - padding.bottom + 15}
                textAnchor="middle"
                className="fill-ams-text-muted text-[9px]"
              >
                {new Date(c.point.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
