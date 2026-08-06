'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { riskStyles } from '../health/components/riskStyles';
import type { AcwrRiskLevel } from '@/lib/modules/health/loadConstants';

/** 详情页返回来源记录键：进入运动员负荷详情前保存来源 URL */
const LOAD_RETURN_KEY = 'ams-load-return';
/** 轮询间隔（毫秒）：保持预警结果与 ACWR 数值实时同步 */
const REFRESH_INTERVAL = 30_000;

interface RiskItem {
  athleteId: number;
  athleteName: string;
  acwr: number | null;
  acuteLoad: number;
  chronicLoad: number;
  riskLevel: AcwrRiskLevel;
}

/** ACWR 标尺上限（进度条按 0-2.0 区间映射） */
const ACWR_SCALE_MAX = 2.0;

const legendItems = [
  { color: 'bg-ams-success', label: '<0.8 负荷不足' },
  { color: 'bg-ams-warning', label: '0.8-1.3 舒适区' },
  { color: 'bg-ams-primary', label: '1.3-1.5 风险升高' },
  { color: 'bg-ams-danger', label: '>1.5 危险区' },
];

/**
 * 风险预警卡片 —— 数据看板
 *
 * 严格依据急慢性负荷比（ACWR）数值进行风险等级判定，
 * 每 30 秒轮询一次风险摘要接口，保证预警结果实时同步。
 */
export function AcwrRiskCard() {
  const [items, setItems] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchRisk = async () => {
      try {
        const res = await fetch('/api/health/load/risk-summary', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && alive) {
          setItems(json.data.items || []);
          setUpdatedAt(json.data.generatedAt || null);
        }
      } catch {
        // 无权限或网络异常时保留空状态
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchRisk();
    const timer = setInterval(fetchRisk, REFRESH_INTERVAL);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  /** 进入详情前记录来源 URL，供详情页「返回」恢复 */
  const goDetail = (athleteId: number) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(LOAD_RETURN_KEY, window.location.href);
    }
  };

  return (
    <div className="ams-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-ams-danger" />
          <h3 className="text-base font-semibold text-ams-text-primary">风险预警</h3>
          <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-[10px] font-medium text-ams-primary">
            ACWR
          </span>
        </div>
        <Link href="/health?tab=load">
          <Button variant="ghost" size="sm">
            查看全部
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="py-8 text-center text-ams-text-secondary">加载中...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-ams-text-secondary">
          <ShieldAlert className="mx-auto h-10 w-10 text-ams-text-muted mb-2" />
          暂无负荷数据，请先在「负荷监控」录入训练负荷
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const risk = riskStyles[item.riskLevel];
              const barWidth = item.acwr === null ? 0 : Math.min(item.acwr, ACWR_SCALE_MAX) / ACWR_SCALE_MAX * 100;
              return (
                <Link
                  key={item.athleteId}
                  href={`/health/load/${item.athleteId}`}
                  onClick={() => goDetail(item.athleteId)}
                  className="flex items-center gap-3 rounded-ams bg-ams-surface-hover p-3 transition-colors hover:bg-ams-surface-hover/80"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${risk.badge}`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ams-text-primary">{item.athleteName}</span>
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${risk.badge}`}>
                        {risk.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 w-20 rounded-full bg-ams-border">
                        <div
                          className={`h-1 rounded-full ${risk.bar}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ams-text-muted">
                        急 {Math.round(item.acuteLoad)} · 慢 {Math.round(item.chronicLoad)}
                      </span>
                    </div>
                  </div>
                  <div className={`shrink-0 text-base font-bold ${item.acwr === null ? 'text-ams-text-muted' : risk.text}`}>
                    {item.acwr === null ? '—' : item.acwr.toFixed(2)}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 border-t border-ams-border pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {legendItems.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-ams-text-muted">
                  <span className={`h-2 w-2 rounded-full ${item.color}`} />
                  {item.label}
                </span>
              ))}
              {updatedAt && (
                <span className="ml-auto text-[10px] text-ams-text-muted">
                  更新于 {new Date(updatedAt).toLocaleTimeString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
