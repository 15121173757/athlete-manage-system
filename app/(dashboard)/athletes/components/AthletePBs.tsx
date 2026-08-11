'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';

interface PBExercise {
  id: number;
  name: string;
  category: string;
  unit: string;
}

interface PersonalBest {
  id: number;
  value: number;
  unit: string;
  achievedDate: string;
  exercise: PBExercise;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN');
}

/**
 * 运动员详情页 —— PB 纪录区块
 * 可视化展示当前运动员各项目的个人最佳成绩（只读）
 */
export default function AthletePBs({ athleteId }: { athleteId: number }) {
  const [pbs, setPbs] = useState<PersonalBest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPBs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pb/${athleteId}`);
      const json = await res.json();
      if (json.success) setPbs(json.data.records);
      else setError(json.error?.message || '加载失败');
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchPBs();
  }, [fetchPBs]);

  // 按分类分组展示（保持分类顺序稳定）
  const grouped = useMemo(() => {
    const map = new Map<string, PersonalBest[]>();
    for (const pb of pbs) {
      const cat = pb.exercise.category || '未分类';
      const arr = map.get(cat);
      if (arr) arr.push(pb);
      else map.set(cat, [pb]);
    }
    return Array.from(map.entries());
  }, [pbs]);

  return (
    <div className="ams-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-ams-warning" />
          <span className="font-medium text-ams-text-primary">PB 纪录</span>
          {!isLoading && !error && (
            <span className="rounded-full bg-ams-warning/10 px-2 py-0.5 text-xs font-medium text-ams-warning">
              {pbs.length} 项
            </span>
          )}
        </div>
        <Link href="/pb" className="text-xs text-ams-primary hover:underline">
          查看全部
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-ams-text-secondary">加载中...</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-ams-danger">
          {error}
          <button type="button" className="ml-2 text-ams-primary underline" onClick={fetchPBs}>
            重试
          </button>
        </div>
      ) : pbs.length === 0 ? (
        <div className="py-8 text-center text-sm text-ams-text-secondary">
          暂无 PB 纪录
          <p className="mt-1 text-xs text-ams-text-muted">可在「PB 纪录」页面查看并维护全部个人最佳成绩</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([cat, rows]) => (
            <div key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-ams-surface-hover px-2.5 py-0.5 text-xs font-medium text-ams-text-secondary">
                  {cat}
                </span>
                <span className="text-xs text-ams-text-muted">{rows.length} 项</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((pb) => (
                  <div
                    key={pb.id}
                    className="rounded-ams border border-ams-border bg-ams-background p-4 transition-colors hover:border-ams-primary/40"
                  >
                    <div className="truncate text-sm font-medium text-ams-text-primary" title={pb.exercise.name}>
                      {pb.exercise.name}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-ams-primary">{pb.value}</span>
                      <span className="text-sm text-ams-text-secondary">{pb.unit}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-ams-text-muted">
                      <Trophy className="h-3.5 w-3.5 text-ams-warning" />
                      {formatDate(pb.achievedDate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
