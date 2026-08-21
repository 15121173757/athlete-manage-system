/**
 * PB 变化趋势时间序列构建 —— 纯函数单元测试
 * 覆盖：实际训练值输出（无累计最佳叠加）、负荷回落如实显示、同日多次训练、
 *       多项目分组、LOWER_BETTER 方向、过滤无效记录/未知项目、空输入等边界场景。
 */

import { describe, it, expect } from 'vitest';
import {
  buildPBTrendSeries,
  type TrendExerciseMeta,
  type TrendRecordInput,
} from '@/lib/modules/pb/PBService';

function meta(id: number, trackType: string, name = '深蹲', unit = 'kg'): TrendExerciseMeta {
  return { id, name, unit, trackType };
}

function rec(
  exerciseId: number,
  trainingDate: string,
  actualLoad: number | null,
  metricValue: number | null = null,
  actualReps = 10
): TrendRecordInput {
  return {
    exerciseId,
    trainingDate,
    actualSets: 3,
    actualReps,
    actualLoad,
    metricValue,
  };
}

describe('buildPBTrendSeries', () => {
  it('单项目 HIGHER_BETTER：每次有效训练输出实际值，不叠加累计最佳', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[1, meta(1, 'MAX_WEIGHT')]]);
    const records = [
      rec(1, '2026-08-01T00:00:00Z', 100),
      rec(1, '2026-08-02T00:00:00Z', 95), // 实际值 95，不保留上一最佳 100
      rec(1, '2026-08-03T00:00:00Z', 110),
      rec(1, '2026-08-05T00:00:00Z', 120),
    ];

    const result = buildPBTrendSeries(records, metaMap);
    expect(result).toHaveLength(1);
    expect(result[0].points).toEqual([
      { date: '2026-08-01', value: 100 },
      { date: '2026-08-02', value: 95 },
      { date: '2026-08-03', value: 110 },
      { date: '2026-08-05', value: 120 },
    ]);
  });

  it('严婉如场景：负荷回落后曲线如实显示实际值（80 后练 70、40 不被改写）', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[18, meta(18, 'MAX_WEIGHT', '杠铃前蹲', 'kg')]]);
    const records = [
      rec(18, '2026-05-20T00:00:00Z', 50),
      rec(18, '2026-06-20T00:00:00Z', 80),
      rec(18, '2026-07-20T00:00:00Z', 70), // 关键：7-20 必须显示 70 而非累计最佳 80
      rec(18, '2026-08-20T00:00:00Z', 40),
    ];

    const result = buildPBTrendSeries(records, metaMap);
    expect(result[0].points).toEqual([
      { date: '2026-05-20', value: 50 },
      { date: '2026-06-20', value: 80 },
      { date: '2026-07-20', value: 70 },
      { date: '2026-08-20', value: 40 },
    ]);
  });

  it('rangeStart：区间之前的记录直接排除（不参与输出也不参与计算）', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[1, meta(1, 'MAX_WEIGHT')]]);
    const records = [
      rec(1, '2026-07-20T00:00:00Z', 100), // 区间之前：直接排除
      rec(1, '2026-08-01T00:00:00Z', 90), // 区间内：输出实际值 90
      rec(1, '2026-08-05T00:00:00Z', 110),
    ];

    const result = buildPBTrendSeries(records, metaMap, '2026-08-01');
    expect(result[0].points).toEqual([
      { date: '2026-08-01', value: 90 },
      { date: '2026-08-05', value: 110 },
    ]);
  });

  it('同日多次训练：保留当日最佳实际值', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[1, meta(1, 'MAX_WEIGHT')]]);
    const records = [
      rec(1, '2026-08-01T00:00:00Z', 100),
      rec(1, '2026-08-01T00:00:00Z', 115),
      rec(1, '2026-08-01T00:00:00Z', 90),
    ];

    const result = buildPBTrendSeries(records, metaMap);
    expect(result[0].points).toEqual([{ date: '2026-08-01', value: 115 }]);
  });

  it('LOWER_BETTER（MIN_TIME）：输出各次实际成绩', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[2, meta(2, 'MIN_TIME', '50米', '秒')]]);
    const records = [
      rec(2, '2026-08-01T00:00:00Z', null, 7.2),
      rec(2, '2026-08-02T00:00:00Z', null, 7.5), // 更慢，如实显示 7.5
      rec(2, '2026-08-03T00:00:00Z', null, 7.0),
    ];

    const result = buildPBTrendSeries(records, metaMap);
    expect(result[0].points).toEqual([
      { date: '2026-08-01', value: 7.2 },
      { date: '2026-08-02', value: 7.5 },
      { date: '2026-08-03', value: 7 },
    ]);
  });

  it('多项目分组：每个项目独立输出一条序列', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([
      [1, meta(1, 'MAX_WEIGHT', '深蹲', 'kg')],
      [2, meta(2, 'MAX_WEIGHT', '卧推', 'kg')],
    ]);
    const records = [
      rec(1, '2026-08-01T00:00:00Z', 100),
      rec(2, '2026-08-01T00:00:00Z', 80),
      rec(1, '2026-08-02T00:00:00Z', 110),
      rec(2, '2026-08-02T00:00:00Z', 85),
    ];

    const result = buildPBTrendSeries(records, metaMap);
    expect(result).toHaveLength(2);
    const byId = new Map(result.map((s) => [s.exerciseId, s]));
    expect(byId.get(1)!.points).toHaveLength(2);
    expect(byId.get(2)!.points).toHaveLength(2);
  });

  it('过滤未知项目（不在 metaMap 中）与无效值（≤0）', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[1, meta(1, 'MAX_WEIGHT')]]);
    const records = [
      rec(1, '2026-08-01T00:00:00Z', 0), // 无效值
      rec(1, '2026-08-02T00:00:00Z', 100),
      rec(999, '2026-08-03T00:00:00Z', 200), // 未知项目
    ];

    const result = buildPBTrendSeries(records, metaMap);
    expect(result).toHaveLength(1);
    expect(result[0].points).toEqual([{ date: '2026-08-02', value: 100 }]);
  });

  it('空记录：返回空数组', () => {
    const metaMap = new Map<number, TrendExerciseMeta>([[1, meta(1, 'MAX_WEIGHT')]]);
    expect(buildPBTrendSeries([], metaMap)).toEqual([]);
  });
});
