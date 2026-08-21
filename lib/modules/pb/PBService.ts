/**
 * 个人最好纪录（PB）服务 —— 独立模块
 *
 * 职责：
 * 1. 训练记录创建时自动更新 PB
 * 2. PB 查询与列表（支持按运动员 / 项目 / 分类过滤）
 * 3. 手动录入新的 PB 成绩
 * 4. PB 值计算（支持不同计量单位）
 * 5. 基于历史训练记录重算全部 PB
 */

import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { BusinessError } from '@/lib/errors/ErrorPresenter';
import {
  extractMetricValue,
  isBetterValue,
  getTrackType,
  type TrackType,
} from '@/lib/exercise/track-types';
import {
  validateTrendRecords,
  type TrendValidationReport,
  type TrendWarning,
} from './trendValidation';
import {
  logTrendQueryStart,
  logTrendQueryComplete,
  logTrendAnomaly,
  logTrendError,
  logTrendRepair,
} from './trendLogger';

// ============================================================
// PB 值计算
// ============================================================

export function calculatePBValue(
  record: {
    actualSets: number;
    actualReps: number;
    actualLoad: number | null;
    metricValue?: number | null;
  },
  trackType: string | null | undefined
): number {
  return extractMetricValue(record, (trackType || 'MAX_WEIGHT') as TrackType);
}

// ============================================================
// 自动更新 PB（训练记录创建 / 更新时调用）
// ============================================================

export async function updatePBOnRecord(record: {
  id: number;
  athleteId: number;
  exerciseId: number;
  actualSets: number;
  actualReps: number;
  actualLoad: number | null;
  metricValue?: number | null;
  trainingDate: Date;
}) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: record.exerciseId },
  });
  if (!exercise || !exercise.isPBTrackable) return;

  const trackType = (exercise.trackType || 'MAX_WEIGHT') as TrackType;
  const pbValue = calculatePBValue(record, trackType);
  const direction = getTrackType(trackType).direction;

  const existingPB = await prisma.personalBest.findUnique({
    where: {
      athleteId_exerciseId: {
        athleteId: record.athleteId,
        exerciseId: record.exerciseId,
      },
    },
  });

  if (existingPB) {
    if (isBetterValue(pbValue, existingPB.value, direction)) {
      await prisma.personalBest.update({
        where: { id: existingPB.id },
        data: {
          value: pbValue,
          unit: exercise.unit,
          achievedDate: record.trainingDate,
          recordId: record.id,
        },
      });
    }
  } else {
    await prisma.personalBest.create({
      data: {
        athleteId: record.athleteId,
        exerciseId: record.exerciseId,
        value: pbValue,
        unit: exercise.unit,
        achievedDate: record.trainingDate,
        recordId: record.id,
      },
    });
  }
}

// ============================================================
// 手动录入新的 PB 成绩
// ============================================================

export async function createManualPB(input: {
  athleteId: number;
  exerciseId: number;
  value: number;
  achievedDate: Date;
}): Promise<{ created: boolean; updated: boolean; record: { id: number; value: number } }> {
  const exercise = await prisma.exercise.findUnique({
    where: { id: input.exerciseId },
  });
  if (!exercise) throw new BusinessError('EXERCISE_NOT_FOUND', '训练项目不存在');
  if (!exercise.isPBTrackable) {
    throw new BusinessError('EXERCISE_NOT_PB_TRACKABLE', `该项目「${exercise.name}」不支持 PB 追踪`);
  }

  const existingPB = await prisma.personalBest.findUnique({
    where: {
      athleteId_exerciseId: {
        athleteId: input.athleteId,
        exerciseId: input.exerciseId,
      },
    },
  });

  // 已有更高 PB 时拒绝覆盖，保证 PB 语义（只记录最好成绩）
  if (existingPB && input.value <= existingPB.value) {
    throw new BusinessError(
      'PB_ALREADY_HIGHER',
      `该运动员在此项目已有更高 PB（${existingPB.value} ${exercise.unit}），无需更新`,
      409
    );
  }

  if (existingPB) {
    const record = await prisma.personalBest.update({
      where: { id: existingPB.id },
      data: {
        value: input.value,
        unit: exercise.unit,
        achievedDate: input.achievedDate,
        recordId: null, // 手动录入不关联训练记录
      },
      select: { id: true, value: true },
    });
    return { created: false, updated: true, record };
  }

  const record = await prisma.personalBest.create({
    data: {
      athleteId: input.athleteId,
      exerciseId: input.exerciseId,
      value: input.value,
      unit: exercise.unit,
      achievedDate: input.achievedDate,
      recordId: null,
    },
    select: { id: true, value: true },
  });
  return { created: true, updated: false, record };
}

// ============================================================
// 查询单条 PB
// ============================================================

export async function getPB(athleteId: number, exerciseId: number) {
  return prisma.personalBest.findUnique({
    where: {
      athleteId_exerciseId: {
        athleteId,
        exerciseId,
      },
    },
    include: { exercise: true },
  });
}

// ============================================================
// 按运动员查询 PB 列表
// ============================================================

export async function listPBsByAthlete(athleteId: number) {
  return prisma.personalBest.findMany({
    where: { athleteId },
    include: { exercise: true },
    orderBy: { value: 'desc' },
  });
}

// ============================================================
// 通用 PB 列表查询（支持过滤、分页，包含 athlete / exercise 关联）
// ============================================================

export interface ListPersonalBestsParams {
  athleteId?: number;
  exerciseId?: number;
  category?: string;
  page?: number;
  pageSize?: number;
  /**
   * 多条件排序：按数组顺序依次作为主/次排序条件。
   * 支持字段：athlete（运动员姓名）、exercise（训练项目）、category（分类）、value（PB 成绩）
   */
  sorts?: PBListSort[];
}

export interface PBListSort {
  field: 'athlete' | 'exercise' | 'category' | 'value';
  direction: 'asc' | 'desc';
}

export async function listPersonalBests(params: ListPersonalBestsParams) {
  const { athleteId, exerciseId, category, sorts, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;
  if (exerciseId) where.exerciseId = exerciseId;
  if (category) where.exercise = { is: { category } };

  // 构建排序：用户指定多条件排序时按其点击顺序应用；否则使用默认排序（成绩降序、达成日期降序）
  const orderBy: Prisma.PersonalBestOrderByWithRelationInput[] =
    sorts && sorts.length > 0
      ? sorts.map((s) => {
          switch (s.field) {
            case 'athlete':
              return { athlete: { name: s.direction } };
            case 'exercise':
              return { exercise: { name: s.direction } };
            case 'category':
              return { exercise: { category: s.direction } };
            case 'value':
              return { value: s.direction };
          }
        })
      : [{ value: 'desc' }, { achievedDate: 'desc' }];

  const [records, total] = await Promise.all([
    prisma.personalBest.findMany({
      where,
      include: {
        athlete: { select: { id: true, name: true } },
        exercise: { select: { id: true, name: true, category: true, unit: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.personalBest.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// 练习分类列表（供"按分类查看"使用）
// ============================================================

export async function listExerciseCategories(): Promise<string[]> {
  const rows = await prisma.exercise.findMany({
    where: { category: { not: '' } },
    select: { category: true },
    distinct: ['category'],
  });
  return rows.map((r) => r.category);
}

// ============================================================
// 重算所有 PB（基于历史训练记录）
// ============================================================

interface PBBestEntry {
  value: number;
  recordId: number;
  achievedDate: Date;
  unit: string;
}

export async function recomputeAllPBs() {
  // 获取所有可追踪 PB 的练习（含追踪类型）
  const exercises = await prisma.exercise.findMany({
    where: { isPBTrackable: true },
    select: { id: true, unit: true, trackType: true },
  });
  const exerciseMap = new Map(exercises.map((e) => [e.id, { unit: e.unit, trackType: e.trackType }]));

  // 获取所有训练记录（仅可追踪 PB 的项目）
  const trainingRecords = await prisma.trainingRecord.findMany({
    where: { exerciseId: { in: Array.from(exerciseMap.keys()) } },
    select: {
      id: true,
      athleteId: true,
      exerciseId: true,
      actualSets: true,
      actualReps: true,
      actualLoad: true,
      metricValue: true,
      trainingDate: true,
    },
  });

  // 按 (athleteId, exerciseId) 分组，找出每组中 PB 值最优的记录
  const bestMap = new Map<string, PBBestEntry>();

  for (const record of trainingRecords) {
    const meta = exerciseMap.get(record.exerciseId);
    if (!meta) continue;
    const value = calculatePBValue(record, meta.trackType);
    if (value <= 0) continue;

    const key = `${record.athleteId}-${record.exerciseId}`;
    const existing = bestMap.get(key);
    const direction = getTrackType(meta.trackType).direction;
    if (!existing || isBetterValue(value, existing.value, direction)) {
      bestMap.set(key, {
        value,
        recordId: record.id,
        achievedDate: record.trainingDate,
        unit: meta.unit,
      });
    }
  }

  // 清空旧 PB 记录后重新生成
  await prisma.personalBest.deleteMany({});

  const creates = Array.from(bestMap.entries()).map(([key, info]) => {
    const [athleteId, exerciseId] = key.split('-').map(Number);
    return prisma.personalBest.create({
      data: {
        athleteId,
        exerciseId,
        value: info.value,
        unit: info.unit,
        achievedDate: info.achievedDate,
        recordId: info.recordId,
      },
    });
  });

  await prisma.$transaction(creates);

  return {
    recomputed: bestMap.size,
    totalTrainingRecords: trainingRecords.length,
  };
}

// ============================================================
// PB 变化趋势（时间序列）
// ============================================================

export interface TrendRecordInput {
  exerciseId: number;
  trainingDate: Date | string;
  actualSets: number;
  actualReps: number;
  actualLoad: number | null;
  metricValue?: number | null;
}

export interface TrendExerciseMeta {
  id: number;
  name: string;
  unit: string;
  trackType: string;
}

export interface TrendPoint {
  /** 训练日期（YYYY-MM-DD） */
  date: string;
  /** 当日实际训练值（同日多次训练取当日最佳） */
  value: number;
}

export interface TrendSeries {
  exerciseId: number;
  exerciseName: string;
  unit: string;
  trackType: string;
  points: TrendPoint[];
}

/**
 * 由训练记录构建成绩趋势时间序列（纯函数，便于单元测试）。
 *
 * 规则：
 * - 按项目分组，组内按训练日期升序；
 * - **每次有效训练（可提取出 >0 的值）都输出一个数据点，值为该次训练的实际成绩**
 *   （依据项目追踪类型取值：MAX_WEIGHT 取负荷、MAX_REPS 取次数、metric 类取成绩值）；
 *   不再叠加「累计最佳」，因此训练负荷回落（如 80kg 后练 70kg）会如实反映在曲线上；
 * - `rangeStart`（YYYY-MM-DD）：区间之前的记录不输出为数据点（无累计依赖，直接排除）；
 * - 过滤掉无法提取有效值（≤0）的记录；
 * - 同一天多次训练，保留当日最佳实际值。
 */
export function buildPBTrendSeries(
  records: TrendRecordInput[],
  metaMap: Map<number, TrendExerciseMeta>,
  rangeStart?: string
): TrendSeries[] {
  const grouped = new Map<number, TrendRecordInput[]>();
  for (const r of records) {
    if (!metaMap.has(r.exerciseId)) continue;
    const arr = grouped.get(r.exerciseId);
    if (arr) arr.push(r);
    else grouped.set(r.exerciseId, [r]);
  }

  const series: TrendSeries[] = [];
  for (const [exerciseId, recs] of grouped) {
    const meta = metaMap.get(exerciseId)!;
    const def = getTrackType(meta.trackType);

    recs.sort(
      (a, b) => new Date(a.trainingDate).getTime() - new Date(b.trainingDate).getTime()
    );

    const points: TrendPoint[] = [];

    for (const r of recs) {
      const value = extractMetricValue(r, def.code);
      if (value <= 0) continue;
      const date = new Date(r.trainingDate).toISOString().slice(0, 10);
      // 区间起点之前的记录不输出为数据点
      if (rangeStart && date < rangeStart) continue;
      const last = points[points.length - 1];
      if (last && last.date === date) {
        // 同一天多次训练，保留当日最佳实际值
        if (isBetterValue(value, last.value, def.direction)) {
          last.value = value;
        }
      } else {
        points.push({ date, value });
      }
    }

    series.push({
      exerciseId,
      exerciseName: meta.name,
      unit: meta.unit,
      trackType: meta.trackType,
      points,
    });
  }

  return series;
}

export interface GetPBTrendDataInput {
  athleteId: number;
  exerciseIds: number[];
  startDate?: string;
  endDate?: string;
}

/**
 * 针对单个 (运动员, 项目) 训练记录推算的累计最佳信息（用于与 PB 表比对）。
 */
interface BestRecordInfo {
  value: number;
  recordId: number;
  achievedDate: Date;
}

/**
 * 校验 PB 表与训练记录推算结果的一致性，并在「推算值更高」时自动修复（仅升级不降级）。
 *
 * 规则：
 * - 依据全部训练记录（无日期截断）计算各项目累计最佳；
 * - 推算值 > PB 表值 → PB 表缺失更新（如记录被补录），自动修复：升级 PB；
 * - 推算值 < PB 表值 → 多为手动录入（recordId 为空）或历史遗留，只告警不降级，避免破坏人工数据；
 * - PB 表不存在但存在有效训练记录 → 自动补建。
 *
 * @returns 一致性校验产生的告警（供前端提示与日志记录）
 */
async function ensurePBTrendConsistency(
  athleteId: number,
  records: {
    id: number;
    exerciseId: number;
    trainingDate: Date;
    actualSets: number;
    actualReps: number;
    actualLoad: number | null;
    metricValue?: number | null;
  }[],
  metaMap: Map<number, TrendExerciseMeta>
): Promise<TrendWarning[]> {
  const warnings: TrendWarning[] = [];

  // 按项目计算累计最佳（含最佳记录 ID 与达成日期）
  const bestMap = new Map<number, BestRecordInfo>();
  for (const r of records) {
    const meta = metaMap.get(r.exerciseId);
    if (!meta) continue;
    const def = getTrackType(meta.trackType);
    const value = extractMetricValue(r, def.code);
    if (value <= 0) continue;
    const cur = bestMap.get(r.exerciseId);
    if (!cur || isBetterValue(value, cur.value, def.direction)) {
      bestMap.set(r.exerciseId, { value, recordId: r.id, achievedDate: r.trainingDate });
    }
  }

  for (const [exerciseId, info] of bestMap) {
    const meta = metaMap.get(exerciseId)!;
    const stored = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId, exerciseId } },
    });

    if (!stored) {
      // PB 缺失但存在有效记录：自动补建（一致性修复）
      await prisma.personalBest.create({
        data: {
          athleteId,
          exerciseId,
          value: info.value,
          unit: meta.unit,
          achievedDate: info.achievedDate,
          recordId: info.recordId,
        },
      });
      logTrendRepair(
        `为「${meta.name}」自动补建缺失的 PB 记录（值 ${info.value} ${meta.unit}）`,
        `athleteId=${athleteId} exerciseId=${exerciseId}`
      );
      warnings.push({
        level: 'WARNING',
        code: 'PB_MISSING_REPAIRED',
        message: `检测到「${meta.name}」缺少 PB 记录，已依据训练记录自动补建`,
        detail: `补建值 ${info.value} ${meta.unit}，来源记录 ID ${info.recordId}`,
      });
      continue;
    }

    const isBetter = isBetterValue(info.value, stored.value, getTrackType(meta.trackType).direction);
    if (!isBetter) {
      // 推算值 ≤ PB 表值：仅当不等时提示（可能为手动录入）
      if (info.value !== stored.value) {
        warnings.push({
          level: 'INFO',
          code: 'PB_HIGHER_THAN_RECORDS',
          message: `「${meta.name}」的 PB 表值（${stored.value} ${meta.unit}）高于训练记录推算值（${info.value} ${meta.unit}），可能为手动录入的 PB`,
          detail: `不影响趋势展示，如需重算可触发 PB 重算`,
        });
      }
      continue;
    }

    // 推算值更高：PB 表缺失更新，自动修复升级（仅升级不降级）
    await prisma.personalBest.update({
      where: { id: stored.id },
      data: {
        value: info.value,
        unit: meta.unit,
        achievedDate: info.achievedDate,
        recordId: info.recordId,
      },
    });
    logTrendRepair(
      `「${meta.name}」PB 由 ${stored.value} 升级为 ${info.value} ${meta.unit}（与训练记录对齐）`,
      `athleteId=${athleteId} exerciseId=${exerciseId} recordId=${info.recordId}`
    );
    warnings.push({
      level: 'INFO',
      code: 'PB_STALE_REPAIRED',
      message: `「${meta.name}」的 PB 记录落后于训练记录，已自动更新为 ${info.value} ${meta.unit}`,
    });
  }

  return warnings;
}

/**
 * 查询指定运动员在多个项目上的 PB 变化趋势数据。
 * 时间序列基于历史训练记录按日累计最佳，与 PB 纪录的取值口径一致。
 *
 * 起始日期不直接过滤查询——区间之前的记录用于计算区间起点的累计最佳，
 * 由 buildPBTrendSeries 的 rangeStart 控制输出；结束日期按天截断查询。
 *
 * 返回结构：
 * - series：各项目趋势序列
 * - stats：范围统计（总记录数/数据点数/起止日期）
 * - validation：数据完整性校验报告（无效记录、同日合并、异常告警）
 */
export async function getPBTrendData(input: GetPBTrendDataInput) {
  const startTime = Date.now();
  logTrendQueryStart(input);

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: input.exerciseIds }, isPBTrackable: true },
    select: { id: true, name: true, unit: true, trackType: true },
  });
  const metaMap = new Map(exercises.map((e) => [e.id, e]));

  const where: Record<string, unknown> = {
    athleteId: input.athleteId,
    exerciseId: { in: input.exerciseIds },
  };
  if (input.endDate) {
    where.trainingDate = { lte: new Date(`${input.endDate}T23:59:59.999Z`) };
  }

  const records = await prisma.trainingRecord.findMany({
    where,
    select: {
      id: true,
      exerciseId: true,
      trainingDate: true,
      actualSets: true,
      actualReps: true,
      actualLoad: true,
      metricValue: true,
    },
    orderBy: { trainingDate: 'asc' },
  });

  const series = buildPBTrendSeries(records, metaMap, input.startDate);

  // 数据完整性校验
  const trackTypeMap = new Map<number, string>(
    exercises.map((e) => [e.id, e.trackType])
  );
  const validation: TrendValidationReport = validateTrendRecords(
    records,
    trackTypeMap,
    input.startDate
  );

  // 一致性自修复：仅当查询覆盖完整历史（无结束日期）时执行，避免与局部范围结论冲突
  let consistencyWarnings: TrendWarning[] = [];
  if (!input.endDate) {
    try {
      consistencyWarnings = await ensurePBTrendConsistency(input.athleteId, records, metaMap);
    } catch (err) {
      logTrendError('PB 一致性校验/自动修复失败', err);
    }
  }

  for (const w of [...validation.warnings, ...consistencyWarnings]) {
    if (w.level === 'WARNING') logTrendAnomaly(w.message, w.detail);
  }

  const totalPoints = series.reduce((n, s) => n + s.points.length, 0);
  logTrendQueryComplete({
    ...input,
    totalRecords: validation.totalRecords,
    seriesCount: series.length,
    totalPoints,
    durationMs: Date.now() - startTime,
  });

  return {
    series,
    stats: {
      totalRecords: validation.totalRecords,
      totalPoints,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
    validation: {
      ...validation,
      warnings: [...validation.warnings, ...consistencyWarnings],
    },
  };
}
