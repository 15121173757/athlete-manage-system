/**
 * PB 变化趋势数据验证 —— 纯函数单元测试
 * 覆盖：有效/无效记录识别、rangeStart 区间前记录统计、同日合并、
 *       告警级别与内容、metric 回退逻辑、空输入等边界场景。
 */

import { describe, it, expect } from 'vitest';
import {
  validateTrendRecords,
  type ValidationRecordInput,
} from '@/lib/modules/pb/trendValidation';

function rec(
  id: number | undefined,
  exerciseId: number,
  trainingDate: string,
  load: number | null,
  metricValue: number | null = null,
  actualReps = 10
): ValidationRecordInput {
  return {
    id,
    exerciseId,
    trainingDate,
    actualSets: 3,
    actualReps,
    actualLoad: load,
    metricValue,
  };
}

const trackTypeMap = new Map<number, string>([
  [1, 'MAX_WEIGHT'],
  [2, 'MAX_REPS'],
  [3, 'MIN_TIME'],
]);

describe('validateTrendRecords', () => {
  it('全部有效记录：isClean 为 true，无告警', () => {
    const records = [
      rec(1, 1, '2026-05-20T00:00:00Z', 50),
      rec(2, 1, '2026-06-20T00:00:00Z', 80),
    ];
    const report = validateTrendRecords(records, trackTypeMap);
    expect(report.totalRecords).toBe(2);
    expect(report.validRecords).toBe(2);
    expect(report.invalidRecords).toBe(0);
    expect(report.isClean).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it('MAX_WEIGHT 无负荷值（null/0）：识别为无效记录并告警', () => {
    const records = [
      rec(11, 1, '2026-06-01T00:00:00Z', 100),
      rec(12, 1, '2026-06-02T00:00:00Z', null), // 无效
      rec(13, 1, '2026-06-03T00:00:00Z', 0), // 无效
    ];
    const report = validateTrendRecords(records, trackTypeMap);
    expect(report.totalRecords).toBe(3);
    expect(report.validRecords).toBe(1);
    expect(report.invalidRecords).toBe(2);
    expect(report.invalidRecordIds).toEqual([12, 13]);
    expect(report.isClean).toBe(false);
    expect(report.warnings.filter((w) => w.code === 'INVALID_METRIC_VALUE')).toHaveLength(2);
  });

  it('MAX_REPS 次数为 0：识别为无效记录', () => {
    const records = [rec(21, 2, '2026-06-01T00:00:00Z', null, null, 0)];
    const report = validateTrendRecords(records, trackTypeMap);
    expect(report.invalidRecords).toBe(1);
    expect(report.invalidRecordIds).toEqual([21]);
  });

  it('metric 类追踪类型缺少 metricValue 时回退到 actualReps：视为有效', () => {
    const records = [
      rec(31, 3, '2026-06-01T00:00:00Z', null, null, 6), // MIN_TIME，metricValue 缺失回退 reps
    ];
    const report = validateTrendRecords(records, trackTypeMap);
    expect(report.validRecords).toBe(1);
    expect(report.invalidRecords).toBe(0);
    expect(report.isClean).toBe(true);
  });

  it('rangeStart 之前的记录：仅计入 skippedByRangeStart，不计入 totalRecords', () => {
    const records = [
      rec(41, 1, '2026-04-10T00:00:00Z', 50), // 区间前
      rec(42, 1, '2026-05-20T00:00:00Z', 80), // 区间内
    ];
    const report = validateTrendRecords(records, trackTypeMap, '2026-05-20');
    expect(report.skippedByRangeStart).toBe(1);
    expect(report.totalRecords).toBe(1);
    expect(report.validRecords).toBe(1);
  });

  it('同日多次训练：统计合并数并输出 INFO 告警', () => {
    const records = [
      rec(51, 1, '2026-06-01T00:00:00Z', 100),
      rec(52, 1, '2026-06-01T00:00:00Z', 115),
      rec(53, 1, '2026-06-01T00:00:00Z', 90),
    ];
    const report = validateTrendRecords(records, trackTypeMap);
    expect(report.sameDayMerged).toBe(2);
    expect(report.totalRecords).toBe(3);
    expect(report.validRecords).toBe(3);
    expect(report.warnings.some((w) => w.code === 'SAME_DAY_MERGED')).toBe(true);
  });

  it('空记录：返回全零且 isClean 为 true 的报告', () => {
    const report = validateTrendRecords([], trackTypeMap);
    expect(report).toEqual({
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      invalidRecordIds: [],
      skippedByRangeStart: 0,
      sameDayMerged: 0,
      warnings: [],
      isClean: true,
    });
  });
});
