'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Dumbbell,
  Flame,
  Heart,
  Sparkles,
  Star,
  Image as ImageIcon,
  Video,
  ExternalLink,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  difficulty: string | null;
  targetMuscles: string | null;
  equipment: string | null;
  demoImageUrl: string | null;
  demoVideoUrl: string | null;
  isFavorite: boolean;
  sortOrder: number;
  isPBTrackable: boolean;
  createdAt: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  '力量': <Dumbbell className="h-4 w-4" />,
  '速度': <Flame className="h-4 w-4" />,
  '耐力': <Heart className="h-4 w-4" />,
  '柔韧': <Sparkles className="h-4 w-4" />,
  '技巧': <Star className="h-4 w-4" />,
  '恢复': <Heart className="h-4 w-4" />,
};

const difficultyColors: Record<string, string> = {
  '初级': 'text-ams-success bg-ams-success/10',
  '中级': 'text-ams-warning bg-ams-warning/10',
  '高级': 'text-ams-danger bg-ams-danger/10',
};

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/exercises/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setExercise(json.data);
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
      const from = sessionStorage.getItem('ams-exercises-return');
      if (from) {
        sessionStorage.removeItem('ams-exercises-return');
        router.push(from);
        return;
      }
    } catch {
      /* 忽略存储异常 */
    }
    router.push('/exercises');
  };

  if (loading) {
    return <div className="ams-card py-16 text-center text-ams-text-secondary">加载中...</div>;
  }

  if (error || !exercise) {
    return (
      <div className="ams-card py-16 text-center">
        <AlertTriangle className="mx-auto mb-2 h-10 w-10 text-ams-danger" />
        <p className="mb-4 text-ams-text-secondary">{error || '练习不存在'}</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部：返回 */}
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-sm text-ams-text-secondary transition-colors hover:text-ams-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      {/* 标题卡片 */}
      <div className="ams-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
            {categoryIcons[exercise.category] || <Dumbbell className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-ams-text-primary">{exercise.name}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <span className="rounded-full px-2 py-0.5 text-xs text-ams-text-secondary bg-ams-surface-hover">
                {exercise.category}
              </span>
              {exercise.difficulty && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColors[exercise.difficulty] || 'text-ams-text-muted bg-ams-surface-hover'}`}>
                  {exercise.difficulty}
                </span>
              )}
              {exercise.isPBTrackable && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-ams-info bg-ams-info/10">
                  <Trophy className="h-3 w-3" />
                  PB追踪
                </span>
              )}
              {exercise.isFavorite && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-ams-warning bg-ams-warning/10">
                  <Star className="h-3 w-3 fill-current" />
                  收藏
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
          <DetailItem label="分类" value={exercise.category} />
          <DetailItem label="计量单位" value={exercise.unit} />
          <DetailItem label="难度" value={exercise.difficulty || '—'} />
          <DetailItem label="PB追踪" value={exercise.isPBTrackable ? '是' : '否'} />
          <DetailItem label="目标肌群" value={exercise.targetMuscles || '—'} span />
          <DetailItem label="所用器材" value={exercise.equipment || '—'} span />
        </div>
      </div>

      {/* 动作描述 */}
      <div className="ams-card p-6">
        <h3 className="ams-table-header mb-4">动作描述</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ams-text-primary">
          {exercise.description || '暂无描述'}
        </p>
      </div>

      {/* 资源信息 */}
      {(exercise.demoImageUrl || exercise.demoVideoUrl) && (
        <div className="ams-card p-6">
          <h3 className="ams-table-header mb-4">资源信息</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {exercise.demoImageUrl && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-ams-text-secondary">
                  <ImageIcon className="h-4 w-4 shrink-0 text-ams-primary" />
                  示范图片
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={exercise.demoImageUrl}
                  alt={`${exercise.name} 示范图片`}
                  className="max-h-64 w-full rounded-ams border border-ams-border bg-ams-background object-contain"
                />
              </div>
            )}
            {exercise.demoVideoUrl && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-ams-text-secondary">
                  <Video className="h-4 w-4 shrink-0 text-ams-primary" />
                  示范视频
                </div>
                <a
                  href={exercise.demoVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-ams border border-ams-border px-3 py-2 text-sm text-ams-primary transition-colors hover:border-ams-primary/60 hover:bg-ams-primary/5"
                >
                  <span className="truncate">{exercise.demoVideoUrl}</span>
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
