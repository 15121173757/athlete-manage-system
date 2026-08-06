'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Athlete {
  id: number;
  name: string;
  gender: string;
  sport: string;
  position?: string;
}

interface AnalysisResult {
  strengths: string;
  areasForImprovement: string;
  recommendations: string;
  summary: string;
  rawContent: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface AnalysisResponse {
  success: boolean;
  data?: {
    analysis: AnalysisResult;
    athlete: { id: number };
    generatedAt: string;
  };
  error?: { code: string; message: string };
}

export default function TrainingAnalysisPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [weeksRange, setWeeksRange] = useState<number>(4);
  const [includePB, setIncludePB] = useState<boolean>(true);
  const [includeInjuries, setIncludeInjuries] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetch('/api/athletes?pageSize=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAthletes(json.data.athletes);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedAthleteId) {
      setError('请先选择一名运动员');
      return;
    }

    setIsLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const res = await fetch('/api/llm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId: Number(selectedAthleteId),
          options: {
            weeksRange,
            includePB,
            includeInjuries,
          },
        }),
      });

      const json: AnalysisResponse = await res.json();

      if (json.success && json.data) {
        setAnalysis(json.data.analysis);
        setGeneratedAt(json.data.generatedAt);
      } else {
        setError(json.error?.message || '生成分析失败，请稍后重试');
      }
    } catch {
      setError('网络错误，请检查连接后重试');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAthleteId, weeksRange, includePB, includeInjuries]);

  const selectedAthlete = athletes.find((a) => a.id === Number(selectedAthleteId));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ams-primary/20">
          <Brain className="h-5 w-5 text-ams-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ams-text-primary">训练分析报告</h2>
          <p className="text-sm text-ams-text-secondary">
            基于运动员训练数据，由 AI 生成多维度分析报告
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="ams-card space-y-5 p-5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-ams-text-primary">
            <FileText className="h-4 w-4 text-ams-primary" />
            分析配置
          </h3>

          <div className="space-y-2">
            <label className="text-sm text-ams-text-secondary">选择运动员</label>
            <select
              value={selectedAthleteId}
              onChange={(e) => setSelectedAthleteId(e.target.value)}
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">请选择运动员</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.sport}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-ams-text-secondary">
              分析时间范围（周）
            </label>
            <div className="flex gap-2">
              {[1, 2, 4, 8, 12].map((w) => (
                <button
                  key={w}
                  onClick={() => setWeeksRange(w)}
                  className={`flex-1 rounded-ams border px-3 py-2 text-sm transition-colors ${
                    weeksRange === w
                      ? 'border-ams-primary bg-ams-primary/10 text-ams-primary'
                      : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface'
                  }`}
                >
                  {w} 周
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-ams-text-secondary">包含数据</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ams-text-primary">
              <input
                type="checkbox"
                checked={includePB}
                onChange={(e) => setIncludePB(e.target.checked)}
                className="h-4 w-4 rounded border-ams-border bg-ams-background text-ams-primary focus:ring-ams-primary"
              />
              个人最好成绩（PB）
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ams-text-primary">
              <input
                type="checkbox"
                checked={includeInjuries}
                onChange={(e) => setIncludeInjuries(e.target.checked)}
                className="h-4 w-4 rounded border-ams-border bg-ams-background text-ams-primary focus:ring-ams-primary"
              />
              伤病记录
            </label>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || !selectedAthleteId}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成报告
              </>
            )}
          </Button>

          {error && (
            <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isLoading && (
            <div className="ams-card flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
              <Loader2 className="h-10 w-10 animate-spin text-ams-primary" />
              <p className="text-ams-text-secondary">
                正在分析 {selectedAthlete?.name || '运动员'} 的训练数据...
              </p>
              <p className="text-xs text-ams-text-muted">
                请稍候，AI 正在处理大量数据
              </p>
            </div>
          )}

          {!isLoading && !analysis && !error && (
            <div className="ams-card flex min-h-[400px] flex-col items-center justify-center gap-3 p-8">
              <Brain className="h-12 w-12 text-ams-text-muted" />
              <p className="text-ams-text-secondary">
                选择运动员并点击「生成报告」开始分析
              </p>
            </div>
          )}

          {!isLoading && analysis && (
            <>
              {selectedAthlete && (
                <div className="ams-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ams-primary/20 text-lg font-semibold text-ams-primary">
                        {selectedAthlete.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-ams-text-primary">
                          {selectedAthlete.name}
                        </h3>
                        <p className="text-sm text-ams-text-secondary">
                          {selectedAthlete.sport}
                          {selectedAthlete.position
                            ? ` · ${selectedAthlete.position}`
                            : ''}
                          {' · '}
                          {selectedAthlete.gender === 'MALE' ? '男' : '女'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ams-text-muted">
                        生成时间
                      </p>
                      <p className="text-sm text-ams-text-secondary">
                        {new Date(generatedAt).toLocaleString('zh-CN')}
                      </p>
                      <p className="mt-1 text-xs text-ams-text-muted">
                        模型：{analysis.provider}
                        {analysis.usage?.totalTokens
                          ? ` · ${analysis.usage.totalTokens} tokens`
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="ams-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-ams-success" />
                  <h3 className="font-semibold text-ams-text-primary">优势</h3>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-ams-text-secondary">
                  {analysis.strengths}
                </div>
              </div>

              <div className="ams-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-ams-warning" />
                  <h3 className="font-semibold text-ams-text-primary">
                    待改进
                  </h3>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-ams-text-secondary">
                  {analysis.areasForImprovement}
                </div>
              </div>

              <div className="ams-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-ams-primary" />
                  <h3 className="font-semibold text-ams-text-primary">
                    训练建议
                  </h3>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-ams-text-secondary">
                  {analysis.recommendations}
                </div>
              </div>

              <div className="ams-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-ams-text-secondary" />
                  <h3 className="font-semibold text-ams-text-primary">总结</h3>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-ams-text-secondary">
                  {analysis.summary}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw className="h-4 w-4" />
                  重新生成
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}