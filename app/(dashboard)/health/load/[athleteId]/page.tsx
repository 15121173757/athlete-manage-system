'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  ShieldAlert,
  Info,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AcwrRiskDescriptions } from '@/lib/modules/health/loadConstants';
import { riskStyles } from '../../components/riskStyles';
import { LoadBarChart } from '../../components/LoadBarChart';

/** 返回来源记录键：由负荷监控视图进入前写入 */
const LOAD_RETURN_KEY = 'ams-load-return';

type RiskLevel = 'LOW' | 'SAFE' | 'ELEVATED' | 'HIGH' | 'NO_DATA';

interface LoadDetail {
  athlete: { id: number; name: string };
  dates: string[];
  dailyLoads: number[];
  acuteLoad: number;
  chronicLoad: number;
  acwr: number | null;
  riskLevel: RiskLevel;
  recordCount: number;
  records: Array<{
    id: number;
    recordDate: string;
    rpe: number;
    durationMinutes: number;
    notes: string | null;
  }>;
  recordTotal: number;
}

export default function AthleteLoadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<LoadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const athleteId = params.athleteId;
    if (!athleteId) return;

    fetch(`/api/health/load/${athleteId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDetail(json.data);
        else setError(json.error?.message || '加载失败');
      })
      .catch(() => setError('网络错误'))
      .finally(() => setIsLoading(false));
  }, [params.athleteId]);

  /** 返回负荷监控：优先恢复来源 URL（保留 tab 状态），无记录时回退默认 */
  const getReturnUrl = () => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(LOAD_RETURN_KEY);
      if (saved) {
        sessionStorage.removeItem(LOAD_RETURN_KEY);
        return saved;
      }
    }
    return '/health?tab=load';
  };

  const handleBack = () => {
    router.push(getReturnUrl());
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ams-text-secondary">加载中...</div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="ams-card py-16 text-center text-ams-text-secondary">
          {error || '负荷数据不存在'}
        </div>
      </div>
    );
  }

  const risk = riskStyles[detail.riskLevel];
  const description = AcwrRiskDescriptions[detail.riskLevel];

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h2 className="text-xl font-semibold text-ams-text-primary">
            负荷与风险预警：{detail.athlete.name}
          </h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${risk.badge}`}>
          {risk.label}
        </span>
      </div>

      {/* 风险评价卡片（标准化文本） */}
      <div className={`ams-card border-l-4 p-6 ${risk.border}`}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className={`h-5 w-5 ${risk.text}`} />
          <h3 className="text-sm font-semibold text-ams-text-primary">风险评价</h3>
        </div>
        <p className={`text-sm leading-relaxed ${risk.text}`}>{description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <div className={`text-4xl font-bold ${detail.acwr === null ? 'text-ams-text-muted' : risk.text}`}>
              {detail.acwr === null ? '—' : detail.acwr.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-ams-text-muted">ACWR 急慢性负荷比（EWMA）</div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-ams-text-muted">急性负荷（近7天 EWMA）</span>
              <span className="font-medium text-ams-text-primary">{Math.round(detail.acuteLoad)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-ams-text-muted">慢性负荷（近28天 EWMA）</span>
              <span className="font-medium text-ams-text-primary">{Math.round(detail.chronicLoad)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 28 天训练量走势 */}
      <div className="ams-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-ams-primary" />
          <h3 className="text-sm font-medium text-ams-text-primary">近 28 天每日训练量（AU）</h3>
        </div>
        {detail.dailyLoads.every((v) => v === 0) ? (
          <div className="py-8 text-center text-ams-text-muted">暂无每日训练量数据</div>
        ) : (
          <>
            <LoadBarChart loads={detail.dailyLoads} />
            <div className="mt-1 flex justify-between text-[10px] text-ams-text-muted">
              <span>{detail.dates[0]?.slice(5)}</span>
              <span>{detail.dates[detail.dates.length - 1]?.slice(5)}</span>
            </div>
          </>
        )}
        <div className="mt-4 flex items-start gap-2 rounded-ams bg-ams-surface-hover px-3 py-2 text-xs text-ams-text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            ACWR 采用指数加权移动平均（EWMA）计算：急性负荷以近 7 天（λ=0.25）、慢性负荷以近 28 天（λ=2/29）递推，对近期训练刺激更敏感。
          </span>
        </div>
      </div>

      {/* 近期负荷记录 */}
      <div className="ams-card overflow-hidden">
        <div className="border-b border-ams-border px-4 py-3">
          <h3 className="text-sm font-medium text-ams-text-primary">
            近期负荷记录
            <span className="ml-2 text-xs text-ams-text-muted">共 {detail.recordTotal} 条</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ams-border">
                <th className="px-4 py-3 text-left ams-table-header">日期</th>
                <th className="px-4 py-3 text-left ams-table-header">RPE</th>
                <th className="px-4 py-3 text-left ams-table-header">时长（分钟）</th>
                <th className="px-4 py-3 text-left ams-table-header">训练量</th>
                <th className="px-4 py-3 text-left ams-table-header">备注</th>
              </tr>
            </thead>
            <tbody>
              {detail.records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ams-text-muted">暂无负荷记录</td>
                </tr>
              ) : (
                detail.records.map((r) => (
                  <tr key={r.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
                    <td className="px-4 py-3 text-ams-text-primary">
                      {new Date(r.recordDate).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-ams-surface-hover px-2 py-0.5 text-xs font-medium text-ams-text-primary">
                        {r.rpe}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ams-text-secondary">{r.durationMinutes}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ams-primary">{r.rpe * r.durationMinutes}</span>
                      <span className="ml-1 text-xs text-ams-text-muted">AU</span>
                    </td>
                    <td className="px-4 py-3 text-ams-text-muted max-w-[200px] truncate">{r.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 空数据提示 */}
      {detail.acwr === null && (
        <div className="flex items-start gap-3 rounded-ams bg-ams-warning/10 px-4 py-3 text-sm text-ams-warning">
          <Activity className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            近 28 天暂无慢性负荷数据，无法计算 ACWR。请返回「负荷监控」录入训练负荷（RPE × 训练时长）后重新查看。
          </span>
        </div>
      )}
    </div>
  );
}
