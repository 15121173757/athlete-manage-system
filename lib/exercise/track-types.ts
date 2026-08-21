/**
 * 练习分类与追踪类型定义 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 集中管理练习的 8 个标准分类
 * 2. 集中管理 6 种「追踪类型」，并定义其与训练量化数据、PB 更新方向的映射
 *
 * 说明：该文件为纯数据/类型模块，可同时被前端组件与服务端逻辑引用，
 * 不得引入 prisma、node 内置模块等运行环境相关依赖。
 */

// ============================================================
// 练习分类（8 个标准类别）
// ============================================================

export const EXERCISE_CATEGORIES = [
  '力量',
  '爆发力',
  '速度与敏捷',
  '耐力',
  '技术',
  '游戏',
  '热身',
  '冷身',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

// ============================================================
// 追踪类型（6 种）
// ============================================================

export const TRACK_TYPE_CODES = [
  'MAX_WEIGHT',
  'MAX_REPS',
  'MAX_TIME',
  'MIN_TIME',
  'MAX_HEIGHT',
  'MAX_DISTANCE',
] as const;

export type TrackType = (typeof TRACK_TYPE_CODES)[number];

/** PB 更新方向：更大更好 / 更小更好 */
export type TrackDirection = 'HIGHER_BETTER' | 'LOWER_BETTER';

/** 追踪类型对应的量化数据来源字段 */
export type TrackField = 'load' | 'reps' | 'metric';

export interface TrackTypeDef {
  code: TrackType;
  /** 中文名称 */
  label: string;
  /** 默认计量单位（创建练习选择该类型时自动带出） */
  unit: string;
  /** PB 更新方向 */
  direction: TrackDirection;
  /** 该追踪类型对应训练记录中的哪个量化字段 */
  field: TrackField;
}

export const TRACK_TYPES: TrackTypeDef[] = [
  { code: 'MAX_WEIGHT', label: '最大重量', unit: 'kg', direction: 'HIGHER_BETTER', field: 'load' },
  { code: 'MAX_REPS', label: '最大次数', unit: '次', direction: 'HIGHER_BETTER', field: 'reps' },
  { code: 'MAX_TIME', label: '最长时间', unit: '秒', direction: 'HIGHER_BETTER', field: 'metric' },
  { code: 'MIN_TIME', label: '最短时间', unit: '秒', direction: 'LOWER_BETTER', field: 'metric' },
  { code: 'MAX_HEIGHT', label: '最大高度', unit: 'cm', direction: 'HIGHER_BETTER', field: 'metric' },
  { code: 'MAX_DISTANCE', label: '最大距离', unit: '米', direction: 'HIGHER_BETTER', field: 'metric' },
];

const TRACK_TYPE_MAP = new Map<TrackType, TrackTypeDef>(
  TRACK_TYPES.map((t) => [t.code, t])
);

/** 根据 code 获取追踪类型定义（未知 code 回退为「最大重量」） */
export function getTrackType(code: string | null | undefined): TrackTypeDef {
  return TRACK_TYPE_MAP.get(code as TrackType) ?? TRACK_TYPES[0];
}

/** 追踪类型中文名 */
export function getTrackTypeLabel(code: string | null | undefined): string {
  return getTrackType(code).label;
}

// ============================================================
// PB 值提取与比较（供服务端 PB 逻辑复用）
// ============================================================

export interface TrackableRecord {
  actualSets: number;
  actualReps: number;
  actualLoad: number | null;
  /** 时间/高度/距离等核心量化值（追踪类型为 metric 时优先使用） */
  metricValue?: number | null;
}

/**
 * 根据追踪类型从训练记录中提取用于 PB 判断的量化值。
 * 对时间/高度/距离类（metric）在缺少 metricValue 时回退到历史字段，
 * 以兼容旧数据（旧数据未存储 metricValue）。
 */
export function extractMetricValue(record: TrackableRecord, trackType: TrackType): number {
  const def = getTrackType(trackType);
  switch (def.field) {
    case 'load':
      return record.actualLoad ?? 0;
    case 'reps':
      return record.actualReps;
    case 'metric':
      return record.metricValue ?? record.actualReps ?? 0;
    default:
      return record.actualReps;
  }
}

/**
 * 判断 candidate 是否优于 current（用于 PB 更新）。
 * 首次记录（current 为 null）时恒为 true。
 */
export function isBetterValue(
  candidate: number,
  current: number | null,
  direction: TrackDirection
): boolean {
  if (current == null) return true;
  return direction === 'LOWER_BETTER' ? candidate < current : candidate > current;
}
