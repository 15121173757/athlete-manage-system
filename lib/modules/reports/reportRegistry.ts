/**
 * 报告类型注册中心 —— 报告中心（AMS）
 *
 * 职责：
 * 1. 集中注册所有报告类型定义（ReportTypeDefinition）
 * 2. 对外提供按 key 查询报告类型定义的能力
 *
 * 扩展方式（预留接口）：
 * 未来新增报告类型（如「出勤报告」「负荷报告」）时，只需：
 * 1. 在 types.ts 的 ReportType 联合类型中补充新 key
 * 2. 在 metricRegistry.ts 中声明该类型的指标
 * 3. 编写对应的聚合服务（实现 ReportData 输出）
 * 4. 在下方 REPORT_REGISTRY 追加一条注册项即可，前端 / API 层无需改动
 */

import { Permissions } from '@/types';
import type { ReportQuery, ReportScope, ReportType, ReportTypeDefinition } from './types';
import { REPORT_TYPE_LABELS, REPORT_SCOPE_LABELS } from './types';
import { ValidationError } from '@/lib/errors/ErrorPresenter';
import { getMetricKeys, METRIC_REGISTRY } from './metricRegistry';
import { aggregateTrainingReport } from './trainingReport';
import { aggregateFitnessReport } from './fitnessReport';
import { aggregateInjuryReport } from './injuryReport';

/** 全部报告类型定义（前端 Tab、API 校验、PDF 导出均以此为单一事实来源） */
export const REPORT_REGISTRY: ReportTypeDefinition[] = [
  {
    key: 'training',
    label: REPORT_TYPE_LABELS.training,
    requiredPermission: Permissions.TRAINING_READ,
    allowScopes: ['PERSONAL', 'TEAM'],
    metrics: METRIC_REGISTRY.training,
    defaultKeys: getMetricKeys('training'),
    aggregate: aggregateTrainingReport,
  },
  {
    key: 'fitness',
    label: REPORT_TYPE_LABELS.fitness,
    requiredPermission: Permissions.FITNESS_READ,
    allowScopes: ['PERSONAL', 'TEAM'],
    metrics: METRIC_REGISTRY.fitness,
    defaultKeys: getMetricKeys('fitness'),
    aggregate: aggregateFitnessReport,
  },
  {
    key: 'injury',
    label: REPORT_TYPE_LABELS.injury,
    requiredPermission: Permissions.HEALTH_READ,
    allowScopes: ['TEAM'],
    metrics: METRIC_REGISTRY.injury,
    defaultKeys: getMetricKeys('injury'),
    aggregate: aggregateInjuryReport,
  },
];

/** 按 key 查询报告类型定义 */
export function getReportDefinition(key: ReportType): ReportTypeDefinition | undefined {
  return REPORT_REGISTRY.find((def) => def.key === key);
}

/** 查询全部报告类型 key（供校验使用） */
export function isReportType(key: string): key is ReportType {
  return REPORT_REGISTRY.some((def) => def.key === key);
}

/**
 * 校验报告生成参数（报告类型维度无关的通用规则）：
 * 1. 时间范围必填（起始 + 结束）
 * 2. 作用域必须在该报告类型允许范围内
 * 3. 个人报告恰好 1 名运动员；团队报告至少 2 名运动员
 *
 * 供 query / export 路由共用，保证线上预览与 PDF 导出参数一致。
 */
export function validateReportQuery(query: ReportQuery, def: ReportTypeDefinition): ReportScope {
  if (!query.startDate || !query.endDate) {
    throw new ValidationError('请选择报告时间范围（起始时间与结束时间）');
  }

  const scope: ReportScope = query.scope ?? 'TEAM';
  if (!def.allowScopes.includes(scope)) {
    const label = REPORT_SCOPE_LABELS[scope];
    throw new ValidationError(`「${def.label}」不支持${label}`);
  }

  const ids = query.athleteIds ?? [];
  if (scope === 'PERSONAL' && ids.length !== 1) {
    throw new ValidationError('个人报告需且仅需选择 1 名运动员');
  }
  if (scope === 'TEAM' && ids.length < 2) {
    throw new ValidationError('团队报告需至少选择 2 名运动员');
  }

  return scope;
}
