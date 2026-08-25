'use client';

/**
 * 指标配置面板 —— 报告中心（AMS）
 *
 * 职责：实现「可自定义指标选择机制」，支持：
 * 1. 按分组勾选 / 取消要展示的指标
 * 2. 调整指标展示顺序（上移 / 下移）
 * 3. 将当前配置保存为个人 / 全局模板（可选设为默认）
 * 4. 从已有模板快速加载配置
 */

import { useState } from 'react';
import { X, ArrowUp, ArrowDown, Save, Trash2, Check, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MetricDefinition, ReportType } from '@/lib/modules/reports/types';

export interface ReportTemplateDTO {
  id: number;
  name: string;
  reportType: ReportType;
  scope: 'PERSONAL' | 'GLOBAL';
  ownerId: number | null;
  config: { keys: string[] };
  isDefault: boolean;
}

interface MetricConfigPanelProps {
  reportType: ReportType;
  metrics: MetricDefinition[];
  selectedKeys: string[];
  templates: ReportTemplateDTO[];
  canManageGlobal: boolean;
  onApply: (keys: string[]) => void;
  onSaveTemplate: (name: string, keys: string[], scope: 'PERSONAL' | 'GLOBAL', isDefault: boolean) => Promise<void>;
  onDeleteTemplate: (id: number) => Promise<void>;
  onClose: () => void;
}

/** 将指标按 group 分组 */
function groupMetrics(metrics: MetricDefinition[]) {
  const map = new Map<string, MetricDefinition[]>();
  for (const m of metrics) {
    const arr = map.get(m.group) ?? [];
    arr.push(m);
    map.set(m.group, arr);
  }
  return Array.from(map.entries());
}

export default function MetricConfigPanel({
  reportType,
  metrics,
  selectedKeys,
  templates,
  canManageGlobal,
  onApply,
  onSaveTemplate,
  onDeleteTemplate,
  onClose,
}: MetricConfigPanelProps) {
  const [draftKeys, setDraftKeys] = useState<string[]>(selectedKeys);
  const [templateName, setTemplateName] = useState('');
  const [scope, setScope] = useState<'PERSONAL' | 'GLOBAL'>('PERSONAL');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const groups = groupMetrics(metrics);
  const keySet = new Set(draftKeys);

  const toggleKey = (key: string) => {
    setDraftKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const moveKey = (key: string, delta: -1 | 1) => {
    setDraftKeys((prev) => {
      const idx = prev.indexOf(key);
      const target = idx + delta;
      if (idx === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleApply = () => {
    onApply(draftKeys);
    setMsg('已应用指标配置');
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      setMsg('请输入模板名称');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await onSaveTemplate(templateName.trim(), draftKeys, scope, isDefault);
      setMsg('模板已保存');
      setTemplateName('');
      setIsDefault(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadTemplate = (keys: string[]) => {
    setDraftKeys(keys);
    setMsg('已加载模板配置');
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setMsg('');
    try {
      await onDeleteTemplate(id);
      setMsg('模板已删除');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-ams-lg border border-ams-border bg-ams-surface shadow-xl">
        {/* 面板头部 */}
        <div className="flex items-center justify-between border-b border-ams-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-ams-primary" />
            <h3 className="text-base font-semibold text-ams-text-primary">指标配置</h3>
            <span className="text-xs text-ams-text-muted">（{reportType}）</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 面板主体 */}
        <div className="ams-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {/* 指标勾选（按分组） */}
          <div className="space-y-4">
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ams-text-muted">
                  {group}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((m) => {
                    const checked = keySet.has(m.key);
                    const orderIdx = draftKeys.indexOf(m.key);
                    return (
                      <div
                        key={m.key}
                        className={`flex items-center gap-2 rounded-ams border px-3 py-2 transition-colors ${
                          checked
                            ? 'border-ams-primary/50 bg-ams-primary/10'
                            : 'border-ams-border bg-ams-background'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKey(m.key)}
                          className="h-4 w-4 accent-ams-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-ams-text-primary">{m.label}</div>
                          {m.description && (
                            <div className="truncate text-xs text-ams-text-muted">{m.description}</div>
                          )}
                        </div>
                        {checked && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <span className="mr-1 text-xs tabular-nums text-ams-primary">
                              {orderIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => moveKey(m.key, -1)}
                              disabled={orderIdx === 0}
                              className="rounded p-0.5 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveKey(m.key, 1)}
                              disabled={orderIdx === draftKeys.length - 1}
                              className="rounded p-0.5 text-ams-text-muted hover:bg-ams-surface-hover hover:text-ams-text-primary disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 模板列表 */}
          {templates.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ams-text-muted">
                已保存模板
              </div>
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded-ams border border-ams-border bg-ams-background px-3 py-2"
                  >
                    <span className="flex-1 truncate text-sm text-ams-text-primary">
                      {t.name}
                      {t.scope === 'GLOBAL' && (
                        <span className="ml-2 rounded-full bg-ams-primary/15 px-2 py-0.5 text-xs text-ams-primary">
                          全局
                        </span>
                      )}
                      {t.isDefault && (
                        <span className="ml-2 rounded-full bg-ams-success/15 px-2 py-0.5 text-xs text-ams-success">
                          默认
                        </span>
                      )}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadTemplate(t.config.keys)}
                    >
                      加载
                    </Button>
                    {t.scope === 'PERSONAL' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        className="rounded p-1 text-ams-text-muted hover:bg-ams-danger/10 hover:text-ams-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 保存为模板 */}
          <div className="mt-6 rounded-ams border border-ams-border bg-ams-background p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ams-text-muted">
              保存为模板
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-xs text-ams-text-muted">模板名称</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="例如：教练周报模板"
                  className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                />
              </div>
              {canManageGlobal && (
                <div>
                  <label className="mb-1 block text-xs text-ams-text-muted">作用域</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'PERSONAL' | 'GLOBAL')}
                    className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
                  >
                    <option value="PERSONAL">个人</option>
                    <option value="GLOBAL">全局</option>
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 pb-2 text-sm text-ams-text-secondary">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 accent-ams-primary"
                />
                设为默认
              </label>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>

          {msg && (
            <div className="mt-4 rounded-ams bg-ams-success/10 px-3 py-2 text-sm text-ams-success">
              {msg}
            </div>
          )}
        </div>

        {/* 面板底部 */}
        <div className="flex items-center justify-between border-t border-ams-border px-5 py-4">
          <span className="text-xs text-ams-text-muted">
            已选 <span className="font-medium text-ams-primary">{draftKeys.length}</span> 项指标
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button size="sm" onClick={handleApply}>
              <Check className="h-4 w-4" />
              应用
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
