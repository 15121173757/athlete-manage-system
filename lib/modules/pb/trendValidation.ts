/**
 * PB 变化趋势数据验证 —— 独立纯函数模块
 *
 * 职责：
 * 1. 对趋势查询抓取的训练记录进行完整性/准确性校验
 * 2. 识别无法提取负荷值的无效记录、同日重复合并、区间前仅参与累计的记录
 * 3. 输出结构化验证报告（含告警），供日志系统与前端提示使用
 *
 * 说明：纯函数模块，不依赖 prisma/fs，便于单元测试。
 */

import {
  extractMetricValue,
  getTrackType,
  type TrackType,
} from '@/lib/exercise/track-types';

// ============================================================
// 类型定义
// ============================================================

/** 参与验证的原始记录结构（与 TrendRecordInput 兼容） */
export interface ValidationRecordInput {
  id?: number;
  exerciseId: number;
  trainingDate: Date | string;
  actualSets: number;
  actualReps: number;
  actualLoad: number | null;
  metricValue?: number | null;
}

/** 验证告警级别 */
export type TrendWarningLevel = 'INFO' | 'WARNING' | 'ERROR';

/** 单条告警 */
export interface TrendWarning {
  level: TrendWarningLevel;
  code: string;
  /** 面向用户的中文描述 */
  message: string;
  /** 关联的运动员/项目/记录信息 */
  detail?: string;
}

/** 数据验证报告 */
export interface TrendValidationReport {
  /** 查询到并参与统计的记录总数（不含区间前仅参与累计的记录） */
  totalRecords: number;
  /** 可提取有效负荷值（>0）的记录数 */
  validRecords: number;
  /** 无法提取有效负荷值（≤0）被过滤的记录数 */
  invalidRecords: number;
  /** 无效记录 ID 列表（无 id 时为空） */
  invalidRecordIds: number[];
  /** rangeStart 之前、仅参与累计最佳计算的记录数 */
  skippedByRangeStart: number;
  /** 同日多次训练被合并的记录数（保留当日最终最佳） */
  sameDayMerged: number;
  /** 告警列表（无异常时为空数组） */
  warnings: TrendWarning[];
  /** 数据完整性是否完全正常 */
  isClean: boolean;
}

// ============================================================
// 验证逻辑
// ============================================================

/**
 * 校验趋势查询抓取的训练记录。
 *
 * @param records     按项目查询到的训练记录（含区间前记录）
 * @param trackTypeMap 项目 ID → 追踪类型（用于提取负荷值）
 * @param rangeStart  YYYY-MM-DD 区间起点（之前的记录仅参与累计，不计入 totalRecords）
 */
export function validateTrendRecords(
  records: ValidationRecordInput[],
  trackTypeMap: Map<number, string>,
  rangeStart?: string
): TrendValidationReport {
  const warnings: TrendWarning[] = [];
  const invalidRecordIds: number[] = [];

  let totalRecords = 0;
  let validRecords = 0;
  let invalidRecords = 0;
  let skippedByRangeStart = 0;
  let sameDayMerged = 0;

  // 按项目统计同一天出现的次数，用于检测同日多训（合并）
  const dateCounts = new Map<string, number>();

  for (const r of records) {
    const trackType = (trackTypeMap.get(r.exerciseId) || 'MAX_WEIGHT') as TrackType;
    const def = getTrackType(trackType);
    const date = new Date(r.trainingDate).toISOString().slice(0, 10);

    // 区间起点之前的记录：仅参与累计最佳计算
    if (rangeStart && date < rangeStart) {
      skippedByRangeStart += 1;
      continue;
    }

    totalRecords += 1;

    const value = extractMetricValue(r, def.code);
    if (value <= 0) {
      invalidRecords += 1;
      if (r.id != null) invalidRecordIds.push(r.id);
      warnings.push({
        level: 'WARNING',
        code: 'INVALID_METRIC_VALUE',
        message: '检测到无法提取有效负荷值的训练记录，该记录未计入趋势',
        detail: `记录 ID ${r.id ?? '-'}（${date}，项目 ID ${r.exerciseId}，追踪类型「${def.label}」），当前字段无法提取出大于 0 的值`,
      });
      continue;
    }
    validRecords += 1;

    // 同日多次训练计数（同一天至少 2 次才会合并）
    const key = `${r.exerciseId}|${date}`;
    const count = (dateCounts.get(key) ?? 0) + 1;
    dateCounts.set(key, count);
  }

  for (const [, count] of dateCounts) {
    if (count > 1) sameDayMerged += count - 1;
  }

  if (sameDayMerged > 0) {
    warnings.push({
      level: 'INFO',
      code: 'SAME_DAY_MERGED',
      message: `检测到 ${sameDayMerged} 条同日多次训练记录，已合并为当日最佳值`,
    });
  }

  return {
    totalRecords,
    validRecords,
    invalidRecords,
    invalidRecordIds,
    skippedByRangeStart,
    sameDayMerged,
    warnings,
    isClean: invalidRecords === 0,
  };
}
