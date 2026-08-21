'use client';

import { ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 练习项编辑副本：id 为本地唯一标识（新建时用时间戳+随机串，编辑时用 existing-{id}） */
export interface EditablePlanItem {
  id: string;
  /** 所属运动员 ID（多运动员独立配置；为空表示共享配置） */
  athleteId: number | null;
  exerciseId: number;
  exercise: { id: number; name: string; category: string; unit: string } | null;
  /** 负荷 (kg) */
  load: number | null;
  reps: number;
  duration: number | null;
  sets: number;
  restSeconds: number | null;
  /** 节奏（自由文本，如 2-0-1-0） */
  tempo: string;
  sortOrder: number;
  notes: string;
}

interface PlanItemEditorProps {
  item: EditablePlanItem;
  index: number;
  total: number;
  onChange: (id: string, updates: Partial<EditablePlanItem>) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onRemove: (id: string) => void;
}

/**
 * 练习项编辑器单行：参数统一顺序为 负荷/次数/时长/组数/间歇/节奏/备注，支持排序与删除。
 * 新建训练计划与草稿计划编辑共用，保证交互一致。
 */
export default function PlanItemEditor({
  item,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: PlanItemEditorProps) {
  return (
    <div className="rounded-ams bg-ams-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(item.id, 'up')}
            disabled={index === 0}
            className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove(item.id, 'down')}
            disabled={index === total - 1}
            className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        <GripVertical className="h-4 w-4 text-ams-text-muted" />
        <span className="text-sm font-medium text-ams-text-primary flex-1">
          {item.exercise?.name || `练习 #${item.exerciseId}`}
        </span>
        <span className="text-xs text-ams-text-muted">
          {item.exercise?.category} · {item.exercise?.unit}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          className="text-ams-danger"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pl-8">
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">负荷 ({item.exercise?.unit || 'kg'})</label>
          <input
            type="number" min={0} step={0.5}
            value={item.load ?? ''}
            onChange={(e) => onChange(item.id, { load: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="空"
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">次数</label>
          <input
            type="number" min={1}
            value={item.reps}
            onChange={(e) => onChange(item.id, { reps: parseInt(e.target.value) || 1 })}
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">时长(分)</label>
          <input
            type="number" min={1}
            value={item.duration ?? ''}
            onChange={(e) => onChange(item.id, { duration: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="可选"
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">组数</label>
          <input
            type="number" min={1}
            value={item.sets}
            onChange={(e) => onChange(item.id, { sets: parseInt(e.target.value) || 1 })}
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">间歇(秒)</label>
          <input
            type="number" min={0}
            value={item.restSeconds ?? ''}
            onChange={(e) => onChange(item.id, { restSeconds: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="60"
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">节奏</label>
          <input
            type="text"
            value={item.tempo}
            onChange={(e) => onChange(item.id, { tempo: e.target.value })}
            placeholder="如 2-0-1-0"
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-ams-text-muted mb-0.5">备注</label>
          <input
            type="text"
            value={item.notes}
            onChange={(e) => onChange(item.id, { notes: e.target.value })}
            placeholder="可选"
            className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-sm text-ams-text-primary"
          />
        </div>
      </div>
    </div>
  );
}
