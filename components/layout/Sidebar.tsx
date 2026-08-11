'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth/auth-store';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Dumbbell,
  Trophy,
  Activity,
  HeartPulse,
  FlaskConical,
  Brain,
  Settings,
  GripVertical,
  Check,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const STORAGE_KEY = 'ams-sidebar-nav-order';

const defaultNavGroups: NavGroup[] = [
  {
    title: '核心业务',
    items: [
      { label: '数据看板', href: '/', icon: LayoutDashboard },
      { label: '运动员', href: '/athletes', icon: Users },
      { label: '体能训练', href: '/training', icon: Dumbbell },
      { label: '体能测试', href: '/fitness', icon: Activity },
      { label: 'PB记录', href: '/pb', icon: Trophy },
      { label: '伤病与负荷监控', href: '/health', icon: HeartPulse },
      { label: '运动科学工具箱', href: '/tools', icon: FlaskConical },
    ],
  },
  {
    title: '智能分析',
    items: [
      { label: '训练分析', href: '/analysis/training', icon: Brain },
      { label: '伤病风险', href: '/analysis/injury-risk', icon: Brain },
      { label: '智能查询', href: '/analysis/query', icon: Brain },
    ],
  },
  {
    title: '系统管理',
    items: [
      { label: '用户管理', href: '/admin/users', icon: Settings },
      { label: '审计日志', href: '/admin/audit', icon: Settings },
    ],
  },
];

// ============================================================
// 本地存储工具函数
// ============================================================

function loadSavedOrder(): Record<string, string[]> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, string[]>;
  } catch {
    return null;
  }
}

function saveOrder(order: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // 存储失败时静默处理（如隐私模式）
  }
}

function applySavedOrder(groups: NavGroup[], saved: Record<string, string[]> | null): NavGroup[] {
  if (!saved) return groups;
  return groups.map((group) => {
    const savedHrefs = saved[group.title];
    if (!savedHrefs || !Array.isArray(savedHrefs)) return group;

    const ordered: NavItem[] = [];
    const remaining: NavItem[] = [...group.items];

    for (const href of savedHrefs) {
      const idx = remaining.findIndex((item) => item.href === href);
      if (idx !== -1) {
        ordered.push(remaining.splice(idx, 1)[0]);
      }
    }
    // 新增的菜单项追加到末尾
    ordered.push(...remaining);
    return { ...group, items: ordered };
  });
}

function extractOrder(groups: NavGroup[]): Record<string, string[]> {
  const order: Record<string, string[]> = {};
  for (const group of groups) {
    order[group.title] = group.items.map((item) => item.href);
  }
  return order;
}

// ============================================================
// 侧边栏组件
// ============================================================

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<NavGroup[]>(defaultNavGroups);
  const [draggedItem, setDraggedItem] = useState<{ groupIdx: number; itemIdx: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ groupIdx: number; itemIdx: number } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 挂载时加载本地存储的排序
  useEffect(() => {
    const saved = loadSavedOrder();
    if (saved) {
      setGroups(applySavedOrder(defaultNavGroups, saved));
    }
    setMounted(true);
  }, []);

  // 排序变化后持久化
  useEffect(() => {
    if (mounted) {
      saveOrder(extractOrder(groups));
    }
  }, [groups, mounted]);

  // ============================================================
  // 拖拽事件处理
  // ============================================================

  const handleDragStart = (groupIdx: number, itemIdx: number) => {
    setDraggedItem({ groupIdx, itemIdx });
  };

  const handleDragOver = (e: React.DragEvent, groupIdx: number, itemIdx: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    // 仅允许同组内排序
    if (draggedItem.groupIdx !== groupIdx) return;
    if (dragOverItem?.groupIdx === groupIdx && dragOverItem?.itemIdx === itemIdx) return;
    setDragOverItem({ groupIdx, itemIdx });
  };

  const handleDrop = (e: React.DragEvent, groupIdx: number, itemIdx: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    if (draggedItem.groupIdx !== groupIdx || draggedItem.itemIdx === itemIdx) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    setGroups((prev) => {
      const next = [...prev];
      const group = { ...next[groupIdx] };
      const items = [...group.items];
      const [moved] = items.splice(draggedItem.itemIdx, 1);
      items.splice(itemIdx, 0, moved);
      group.items = items;
      next[groupIdx] = group;
      return next;
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleResetOrder = () => {
    setGroups(defaultNavGroups);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r border-ams-border bg-ams-surface">
      <div className="flex h-16 items-center gap-2 border-b border-ams-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-ams bg-ams-primary text-white font-bold">
          A
        </div>
        <span className="text-base font-semibold text-ams-text-primary">
          运动员管理系统
        </span>
      </div>

      <nav className="ams-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, groupIdx) => (
          <div key={group.title} className="mb-6">
            <div className="ams-table-header mb-2 flex items-center justify-between px-3">
              <span>{group.title}</span>
              {isEditMode && group.items.length > 1 && (
                <button
                  onClick={handleResetOrder}
                  className="flex items-center gap-1 text-xs text-ams-primary hover:underline"
                  title="恢复默认排序"
                >
                  <RotateCcw className="h-3 w-3" />
                  重置
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {group.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                const isDragging =
                  draggedItem?.groupIdx === groupIdx &&
                  draggedItem?.itemIdx === itemIdx;
                const isDragOver =
                  dragOverItem?.groupIdx === groupIdx &&
                  dragOverItem?.itemIdx === itemIdx &&
                  !isDragging;
                const canDrag = isEditMode && group.items.length > 1;

                return (
                  <li
                    key={item.href}
                    draggable={canDrag}
                    onDragStart={() => handleDragStart(groupIdx, itemIdx)}
                    onDragOver={(e) => handleDragOver(e, groupIdx, itemIdx)}
                    onDrop={(e) => handleDrop(e, groupIdx, itemIdx)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'group/item relative rounded-ams transition-all',
                      isDragging && 'opacity-40',
                      canDrag && 'cursor-move'
                    )}
                  >
                    {/* 拖拽放置指示线 */}
                    {isDragOver && (
                      <div className="absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-ams-primary z-10" />
                    )}
                    <Link
                      href={item.href}
                      onClick={(e) => {
                        if (isEditMode) {
                          e.preventDefault();
                          return;
                        }
                        onNavigate?.();
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-ams px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-ams-primary/10 text-ams-primary font-medium'
                          : 'text-ams-text-secondary hover:bg-ams-surface-hover hover:text-ams-text-primary',
                        isEditMode && 'pointer-events-auto'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {canDrag && (
                        <GripVertical className="h-3.5 w-3.5 text-ams-text-muted opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* 底部区域：编辑模式 + 用户信息 */}
      <div className="border-t border-ams-border p-4">
        {isEditMode && (
          <div className="mb-3">
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => setIsEditMode(false)}
            >
              <Check className="h-4 w-4" />
              完成排序
            </Button>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ams-primary/20 text-ams-primary text-sm font-medium">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ams-text-primary">
                {user.name}
              </div>
              <div className="text-xs text-ams-text-muted">
                {user.role === 'COACH' ? '教练员' : user.role === 'MEDICAL' ? '医研人员' : '管理员'}
              </div>
            </div>
            {!isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="rounded p-1.5 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary transition-colors"
                title="调整导航排序"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
