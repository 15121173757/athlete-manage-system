/**
 * 运动能力分析 —— 运动员管理系统（AMS）
 *
 * 纯计算模块（可同时被前端组件与服务端逻辑引用，不得引入 prisma / node 依赖）：
 * 1. Z 分数：Z = (成绩 - 常模均值) / 常模标准差；「越低越好」方向取反
 * 2. 单项标准分（T 分）：T = 50 + 10 × Z，夹紧到 [0, 100]
 * 3. 素质类别得分：该类所选测试 T 分的平均
 * 4. 运动能力综合评分（TSA）：所选素质类别得分的等权平均
 *
 * 计算标准说明：Z 分数为通用统计学定义；T 分采用学术界通行 T-Score
 * 标准分（均值 50、标准差 10）；TSA 为各分析维度得分的等权综合。
 *
 * 百分等级口径（基于显示值，保证界面可手算复现）：
 * - 单项百分位：Φ(该测试 Z 分数)
 * - 维度百分等级：Φ(该维度所选测试 Z 分数的算术平均)
 * - TSA 百分等级：Φ((TSA - 50) / 10)（维度等权，与 TSA 计算口径一致）
 * 其中 Φ 为标准正态分布累积分布函数。
 */

import { TestStandard } from '@/lib/fitness/test-types';

export const DIRECTION_HIGHER_BETTER = 'HIGHER_BETTER';
export const DIRECTION_LOWER_BETTER = 'LOWER_BETTER';

/** 参与分析的成绩条目（数值型测试成绩 + 选定常模） */
export interface AbilityScoreItem {
  testId: number;
  testName: string;
  category: string;
  unit: string;
  direction: string;
  /** 数值成绩（NUMERIC 测试） */
  value: number;
  /** 用户为该测试选择的常模 */
  norm: TestStandard;
}

/** 单项计算明细 */
export interface ItemScore {
  testId: number;
  testName: string;
  category: string;
  unit: string;
  value: number;
  normName: string;
  mean: number;
  stdDev: number;
  /** 已按评价方向归一化的 Z 分数（「越低越好」已取反） */
  zScore: number;
  /** 百分位数：Φ(Z) × 100（保留一位小数，0~100） */
  percentile: number;
  /** 标准分 T = 50 + 10Z，范围 [0, 100] */
  tScore: number;
}

/** 素质类别得分 */
export interface DimensionScore {
  category: string;
  /** 该类所选测试 T 分的平均 */
  score: number;
  /** 该类所选测试 Z 分数算术平均对应的百分等级（保留一位小数，0~100） */
  percentile: number;
  itemCount: number;
  items: ItemScore[];
}

/** 运动能力综合分析输出 */
export interface TSAOutput {
  dimensions: DimensionScore[];
  /** 运动能力综合评分：各维度得分等权平均；无维度时为 null */
  tsa: number | null;
  /** TSA 百分等级：Φ((TSA-50)/10)（维度等权口径）；无维度时为 null */
  percentile: number | null;
}

/** 保留一位小数（避免浮点长尾） */
export function roundScore(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * 计算 Z 分数：
 * - 越高越好：Z = (成绩 - 均值) / 标准差
 * - 越低越好：Z = (均值 - 成绩) / 标准差（等价于取反）
 * 标准差非正或成绩无效时返回 null。
 */
export function computeZScore(
  value: number,
  mean: number,
  stdDev: number,
  direction: string
): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(mean) || !Number.isFinite(stdDev) || stdDev <= 0) {
    return null;
  }
  const z = (value - mean) / stdDev;
  return direction === DIRECTION_LOWER_BETTER ? -z : z;
}

/** T 分 = 50 + 10 × Z，夹紧到 [0, 100] */
export function tScoreFromZ(z: number): number {
  const t = 50 + 10 * z;
  return Math.min(100, Math.max(0, t));
}

/**
 * 误差函数 erf(x)（Abramowitz & Stegun 7.1.26 近似，最大误差 < 1.5e-7）
 * 仅用于标准正态分布累积分布函数的数值计算。
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** 标准正态分布累积分布函数 Φ(z) */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Z 分数对应的百分等级（百分数，保留一位小数，范围 0~100） */
export function percentileFromZ(z: number): number {
  return roundScore(normalCdf(z) * 100);
}

/** 计算单项明细；数据非法（无成绩 / 常模无效）返回 null */
export function computeItemScore(item: AbilityScoreItem): ItemScore | null {
  const { norm } = item;
  if (!norm || !Number.isFinite(norm.mean) || !Number.isFinite(norm.stdDev) || norm.stdDev <= 0) {
    return null;
  }
  const zScore = computeZScore(item.value, norm.mean, norm.stdDev, item.direction);
  if (zScore === null) return null;
  const roundedZ = roundScore(zScore);
  return {
    testId: item.testId,
    testName: item.testName,
    category: item.category,
    unit: item.unit,
    value: item.value,
    normName: norm.normName,
    mean: norm.mean,
    stdDev: norm.stdDev,
    zScore: roundedZ,
    // 单项百分位基于显示 Z 分数（保留一位），保证界面可手算复现
    percentile: percentileFromZ(roundedZ),
    tScore: roundScore(tScoreFromZ(zScore)),
  };
}

/**
 * 计算运动能力综合分析：
 * - 按素质类别分组，类别得分 = 该类所选测试 T 分平均
 * - TSA = 各类别得分等权平均
 */
export function computeTSA(items: AbilityScoreItem[]): TSAOutput {
  const scored = items
    .map((it) => computeItemScore(it))
    .filter((s): s is ItemScore => s !== null);

  const byCategory = new Map<string, ItemScore[]>();
  for (const s of scored) {
    const list = byCategory.get(s.category) || [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const dimensions: DimensionScore[] = [...byCategory.entries()].map(([category, list]) => {
    const sum = list.reduce((acc, s) => acc + s.tScore, 0);
    // 维度百分等级 = Φ(该维度测试 Z 分数的算术平均)，基于显示 Z 分数
    const avgZ = list.reduce((acc, s) => acc + s.zScore, 0) / list.length;
    return {
      category,
      score: roundScore(sum / list.length),
      percentile: percentileFromZ(avgZ),
      itemCount: list.length,
      items: list,
    };
  });

  const tsa =
    dimensions.length === 0
      ? null
      : roundScore(dimensions.reduce((acc, d) => acc + d.score, 0) / dimensions.length);

  // TSA 百分等级 = Φ((TSA - 50) / 10)（维度等权，与 TSA 口径一致，基于显示 TSA 值）
  const percentile = tsa === null ? null : percentileFromZ((tsa - 50) / 10);

  return { dimensions, tsa, percentile };
}

/** TSA / 类别得分分级 */
export function scoreLevel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: '优秀', color: 'text-ams-success' };
  if (score >= 70) return { label: '良好', color: 'text-ams-primary' };
  if (score >= 60) return { label: '及格', color: 'text-ams-warning' };
  return { label: '待提升', color: 'text-ams-danger' };
}
