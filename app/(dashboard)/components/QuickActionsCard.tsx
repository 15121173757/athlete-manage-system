'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  ClipboardList,
  ClipboardCheck,
  Activity,
  Trophy,
  ArrowRight,
  Pencil,
  Check,
  GripVertical,
  X,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 快捷操作栏 —— 数据看板
 *
 * 允许用户按个人使用习惯添加 / 删除 / 拖拽排序快捷指令，
 * 排序结果持久化到 localStorage（键 ams-quick-actions）。
 */

const STORAGE_KEY = 'ams-quick-actions';

interface QuickCommand {
  id: string;
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

/** 全部可用指令目录 */
const COMMAND_CATALOG: QuickCommand[] = [
  { id: 'new-athlete', label: '新建运动员档案', desc: '添加新运动员', href: '/athletes/new', icon: Users, color: 'text-ams-primary', bgColor: 'bg-ams-primary/20' },
  { id: 'new-plan', label: '制定训练计划', desc: '创建训练计划', href: '/training/plans/new', icon: ClipboardList, color: 'text-ams-warning', bgColor: 'bg-ams-warning/20' },
  { id: 'add-record', label: '出勤管理', desc: '记录运动员出勤', href: '/training/records', icon: ClipboardCheck, color: 'text-ams-success', bgColor: 'bg-ams-success/20' },
  { id: 'add-load', label: '录入训练负荷', desc: 'RPE × 时长统计训练量', href: '/health?tab=load', icon: Activity, color: 'text-ams-primary', bgColor: 'bg-ams-primary/20' },
  { id: 'fitness', label: '动作库', desc: '练习库与测试库', href: '/library', icon: Activity, color: 'text-ams-warning', bgColor: 'bg-ams-warning/20' },
  { id: 'pb', label: 'PB追踪', desc: '个人最佳成绩', href: '/pb', icon: Trophy, color: 'text-ams-success', bgColor: 'bg-ams-success/20' },
];

const DEFAULT_ACTIVE_IDS = ['new-athlete', 'new-plan', 'add-record', 'add-load', 'fitness'];

// ============================================================
// 本地存储工具函数
// ============================================================

function loadActiveIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_ACTIVE_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_ACTIVE_IDS];
    const valid = new Set(COMMAND_CATALOG.map((c) => c.id));
    const ids = parsed.filter((id) => typeof id === 'string' && valid.has(id));
    // 数据损坏时回退默认配置
    return ids.length > 0 ? [...new Set(ids)] : [...DEFAULT_ACTIVE_IDS];
  } catch {
    return [...DEFAULT_ACTIVE_IDS];
  }
}

function saveActiveIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 存储失败时静默处理（如隐私模式）
  }
}

// ============================================================
// 快捷操作栏组件
// ============================================================

export function QuickActionsCard() {
  const [activeIds, setActiveIds] = useState<string[]>(DEFAULT_ACTIVE_IDS);
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    setActiveIds(loadActiveIds());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveActiveIds(activeIds);
  }, [activeIds, mounted]);

  const activeCommands = activeIds
    .map((id) => COMMAND_CATALOG.find((c) => c.id === id))
    .filter((c): c is QuickCommand => Boolean(c));

  const availableCommands = COMMAND_CATALOG.filter((c) => !activeIds.includes(c.id));

  const addCommand = (id: string) => {
    setActiveIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeCommand = (id: string) => {
    setActiveIds((prev) => prev.filter((i) => i !== id));
  };

  // ---- 拖拽排序（仅编辑模式） ----
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    if (dragOverIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    setActiveIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleReset = () => {
    setActiveIds(DEFAULT_ACTIVE_IDS);
  };

  return (
    <div className="ams-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ams-text-primary">快捷操作</h3>
          {!isEditing && (
            <span className="text-xs text-ams-text-muted">{activeCommands.length} 项</span>
          )}
        </div>
        {isEditing ? (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
            <Check className="h-4 w-4" />
            完成管理
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4" />
            管理
          </Button>
        )}
      </div>

      {activeCommands.length === 0 ? (
        <div className="rounded-ams bg-ams-surface-hover p-6 text-center text-sm text-ams-text-muted">
          暂无快捷指令，点击右上角「管理」添加
        </div>
      ) : (
        <div className="space-y-3">
          {activeCommands.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx && !isDragging;

            if (isEditing) {
              return (
                <div
                  key={cmd.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'relative flex items-center gap-3 rounded-ams bg-ams-surface-hover p-3 transition-all',
                    isDragging && 'opacity-40',
                    'cursor-move'
                  )}
                >
                  {isDragOver && (
                    <div className="absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-ams-primary" />
                  )}
                  <GripVertical className="h-4 w-4 shrink-0 text-ams-text-muted" />
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-ams ${cmd.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cmd.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ams-text-primary">{cmd.label}</div>
                    <div className="text-xs text-ams-text-muted">{cmd.desc}</div>
                  </div>
                  <button
                    onClick={() => removeCommand(cmd.id)}
                    className="rounded p-1 text-ams-text-muted transition-colors hover:bg-ams-danger/10 hover:text-ams-danger"
                    title="移除指令"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            }

            return (
              <Link
                key={cmd.id}
                href={cmd.href}
                className="flex items-center justify-between rounded-ams bg-ams-surface-hover p-3 transition-colors hover:bg-ams-surface-hover/80"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-ams ${cmd.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cmd.color}`} />
                  </div>
                  <span className="text-sm text-ams-text-primary">{cmd.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-ams-text-muted" />
              </Link>
            );
          })}
        </div>
      )}

      {/* 编辑模式：添加指令面板 */}
      {isEditing && (
        <div className="mt-4 border-t border-ams-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ams-text-muted">添加指令</span>
            <button
              onClick={handleReset}
              className="text-xs text-ams-primary hover:underline"
            >
              恢复默认
            </button>
          </div>
          {availableCommands.length === 0 ? (
            <div className="text-center text-xs text-ams-text-muted">所有指令均已添加</div>
          ) : (
            <div className="space-y-2">
              {availableCommands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => addCommand(cmd.id)}
                    className="flex w-full items-center gap-3 rounded-ams border border-dashed border-ams-border px-3 py-2 text-left transition-colors hover:border-ams-primary/60 hover:bg-ams-primary/5"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-ams ${cmd.bgColor}`}>
                      <Icon className={`h-3.5 w-3.5 ${cmd.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ams-text-primary">{cmd.label}</div>
                      <div className="text-xs text-ams-text-muted">{cmd.desc}</div>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-ams-primary" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
