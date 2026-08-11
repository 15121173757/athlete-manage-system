/**
 * 器材选择器 —— 以简笔画网格形式多选训练器材
 *
 * 受控组件：value 为逗号分隔的器材名称字符串，onChange 输出新的字符串。
 * 与表单的「所用器材」文本字段双向同步，兼容自由输入的自定义器材。
 */
'use client';

import { Check } from 'lucide-react';
import { EQUIPMENT_ICONS } from './registry';
import { EquipmentIcon } from './EquipmentIcon';

interface EquipmentPickerProps {
  value: string;
  onChange: (next: string) => void;
}

export function EquipmentPicker({ value, onChange }: EquipmentPickerProps) {
  const selected = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const toggle = (label: string) => {
    const has = selected.includes(label);
    const next = has ? selected.filter((s) => s !== label) : [...selected, label];
    onChange(next.join(','));
  };

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {EQUIPMENT_ICONS.map((item) => {
        const isSelected = selected.includes(item.label);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => toggle(item.label)}
            aria-pressed={isSelected}
            title={`选择${item.label}`}
            className={`group flex flex-col items-center gap-1 rounded-ams border px-1 py-2 transition-colors duration-150 ${
              isSelected
                ? 'border-ams-primary bg-ams-primary/10 text-ams-primary'
                : 'border-ams-border/60 bg-ams-surface text-ams-text-secondary hover:border-ams-primary/50 hover:bg-ams-surface-hover hover:text-ams-text-primary'
            }`}
          >
            <span className="relative">
              <EquipmentIcon icon={item.key} className="h-7 w-7" />
              {isSelected && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ams-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </span>
            <span className="text-xs leading-tight">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
