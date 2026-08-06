'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Dumbbell,
  Zap,
  Wind,
  Flame,
  Sparkles,
  Heart,
  Video,
  Image as ImageIcon,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FitnessTest {
  id: number;
  name: string;
  category: string;
  unit: string;
  direction: string;
  warningThreshold: number | null;
  description: string | null;
  purpose: string | null;
  applicableGroup: string | null;
  equipment: string | null;
  demoVideoUrl: string | null;
  diagramUrl: string | null;
  scoringStandard: string | null;
  referenceRange: string | null;
  precautions: string | null;
}

const categoryIcons: Record<string, React.ReactNode> = {
  '力量测试': <Dumbbell className="h-4 w-4" />,
  '爆发力测试': <Zap className="h-4 w-4" />,
  '速度敏捷测试': <Wind className="h-4 w-4" />,
  '供能系统测试': <Flame className="h-4 w-4" />,
  '柔韧测试': <Sparkles className="h-4 w-4" />,
  '其他': <Heart className="h-4 w-4" />,
};

const directionLabels: Record<string, string> = {
  HIGHER_BETTER: '越高越好',
  LOWER_BETTER: '越低越好',
};

export default function FitnessTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [test, setTest] = useState<FitnessTest | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fitness/tests/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setTest(json.data);
        } else {
          setError(json.error?.message || '加载失败');
        }
      } catch {
        if (!cancelled) setError('网络错误，加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** 返回列表：优先恢复进入详情前的来源页 */
  const handleBack = () => {
    try {
      const from = sessionStorage.getItem('ams-fitness-tests-return');
      if (from) {
        sessionStorage.removeItem('ams-fitness-tests-return');
        router.push(from);
        return;
      }
    } catch {
      /* 忽略存储异常 */
    }
    router.push('/fitness?tab=tests');
  };

  if (loading) {
    return <div className="ams-card py-16 text-center text-ams-text-secondary">加载中...</div>;
  }

  if (error || !test) {
    return (
      <div className="ams-card py-16 text-center">
        <AlertTriangle className="mx-auto mb-2 h-10 w-10 text-ams-danger" />
        <p className="mb-4 text-ams-text-secondary">{error || '测试项目不存在'}</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>
      </div>
    );
  }

  const isHigher = test.direction === 'HIGHER_BETTER';
  const equipmentList = test.equipment
    ? test.equipment.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-4">
      {/* 顶部：返回 + 标题 */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-ams-text-secondary transition-colors hover:text-ams-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>

      {/* 标题卡片 */}
      <div className="ams-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
            {categoryIcons[test.category] || <Dumbbell className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-ams-text-primary">{test.name}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <span className="rounded-full px-2 py-0.5 text-xs text-ams-text-secondary bg-ams-surface-hover">
                {test.category}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isHigher
                    ? 'text-ams-success bg-ams-success/10'
                    : 'text-ams-warning bg-ams-warning/10'
                }`}
              >
                {directionLabels[test.direction] || test.direction}
              </span>
              {test.warningThreshold != null && (
                <span className="rounded-full px-2 py-0.5 text-xs text-ams-danger bg-ams-danger/10">
                  预警 ≤ {test.warningThreshold}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="ams-card p-6">
        <h3 className="ams-table-header mb-4">基本信息</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <DetailItem label="计量单位" value={test.unit} />
          <DetailItem label="分类" value={test.category} />
          <DetailItem label="评价方向" value={directionLabels[test.direction] || test.direction} />
          <DetailItem
            label="预警阈值"
            value={test.warningThreshold != null ? `≤ ${test.warningThreshold}` : '无'}
          />
          <DetailItem label="适用群体" value={test.applicableGroup || '—'} span />
        </div>
      </div>

      {/* 描述信息 */}
      <div className="ams-card p-6">
        <h3 className="ams-table-header mb-4">描述信息</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailItem label="测试描述" value={test.description || '—'} span={!test.purpose} />
          <DetailItem label="测试目的" value={test.purpose || '—'} />
        </div>
      </div>

      {/* 测试标准 */}
      {(test.scoringStandard || test.referenceRange || test.precautions) && (
        <div className="ams-card p-6">
          <h3 className="ams-table-header mb-4">测试标准</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailItem label="评分标准" value={test.scoringStandard || '—'} />
            <DetailItem label="参考范围" value={test.referenceRange || '—'} />
            <DetailItem label="注意事项" value={test.precautions || '—'} span />
          </div>
        </div>
      )}

      {/* 资源信息 */}
      {(equipmentList.length > 0 || test.demoVideoUrl || test.diagramUrl) && (
        <div className="ams-card p-6">
          <h3 className="ams-table-header mb-4">资源信息</h3>
          {equipmentList.length > 0 && (
            <div className="mb-4">
              <span className="ams-table-header">所需器材</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {equipmentList.map((eq, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-ams-background px-2.5 py-1 text-xs text-ams-text-secondary"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {test.demoVideoUrl && (
              <div className="flex items-center gap-2 text-sm">
                <Video className="h-4 w-4 shrink-0 text-ams-primary" />
                <a
                  href={test.demoVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 text-ams-primary hover:underline"
                >
                  <span className="truncate">示范视频</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
            {test.diagramUrl && (
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon className="h-4 w-4 shrink-0 text-ams-primary" />
                <a
                  href={test.diagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 text-ams-primary hover:underline"
                >
                  <span className="truncate">动作图解</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  span,
}: {
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={span ? 'col-span-2 md:col-span-2' : ''}>
      <div className="ams-table-header mb-1">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ams-text-primary">
        {value}
      </div>
    </div>
  );
}
