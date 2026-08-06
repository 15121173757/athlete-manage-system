/**
 * ACWR 风险分级的前端样式映射 —— 伤病与负荷监控模块（AMS）
 *
 * 颜色分区约定（用户自定义）：
 * - LOW（ACWR < 0.8）：绿色（青绿）标识
 * - SAFE（0.8 ≤ ACWR ≤ 1.3）：黄色（琥珀）标识
 * - ELEVATED（1.3 < ACWR ≤ 1.5）：橙色（荧光橙）标识
 * - HIGH（ACWR > 1.5）：红色（珊瑚红）标识
 */

import { AcwrRiskLabels, type AcwrRiskLevel } from '@/lib/modules/health/loadConstants';

export interface RiskStyle {
  label: string;
  text: string;
  badge: string;
  border: string;
  bar: string;
}

export const riskStyles: Record<AcwrRiskLevel, RiskStyle> = {
  LOW: {
    label: AcwrRiskLabels.LOW,
    text: 'text-ams-success',
    badge: 'text-ams-success bg-ams-success/10 border-ams-success/30',
    border: 'border-l-ams-success',
    bar: 'bg-ams-success',
  },
  SAFE: {
    label: AcwrRiskLabels.SAFE,
    text: 'text-ams-warning',
    badge: 'text-ams-warning bg-ams-warning/10 border-ams-warning/30',
    border: 'border-l-ams-warning',
    bar: 'bg-ams-warning',
  },
  ELEVATED: {
    label: AcwrRiskLabels.ELEVATED,
    text: 'text-ams-primary',
    badge: 'text-ams-primary bg-ams-primary/10 border-ams-primary/30',
    border: 'border-l-ams-primary',
    bar: 'bg-ams-primary',
  },
  HIGH: {
    label: AcwrRiskLabels.HIGH,
    text: 'text-ams-danger',
    badge: 'text-ams-danger bg-ams-danger/10 border-ams-danger/30',
    border: 'border-l-ams-danger',
    bar: 'bg-ams-danger',
  },
  NO_DATA: {
    label: AcwrRiskLabels.NO_DATA,
    text: 'text-ams-text-muted',
    badge: 'text-ams-text-muted bg-ams-surface-hover border-ams-border',
    border: 'border-l-ams-border',
    bar: 'bg-ams-border',
  },
};
