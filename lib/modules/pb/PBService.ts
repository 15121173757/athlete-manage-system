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
import { BusinessError } from '@/lib/errors/ErrorPresenter';

// ============================================================
// PB 值计算
// ============================================================

export function calculatePBValue(
  record: { actualSets: number; actualReps: number; actualLoad: number | null },
  exerciseUnit: string
): number {
  if (exerciseUnit === 'kg' || exerciseUnit === '重量') {
    // 最大负荷 = 单次最大重量（非训练总量 load×sets×reps）
    if (record.actualLoad == null) return 0;
    return record.actualLoad;
  }

  if (exerciseUnit === '次' || exerciseUnit === '次数') {
    return record.actualSets * record.actualReps;
  }

  if (exerciseUnit === '秒' || exerciseUnit === '时间') {
    return record.actualReps;
  }

  if (exerciseUnit === '米' || exerciseUnit === '距离') {
    return record.actualReps;
  }

  return record.actualReps;
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
  trainingDate: Date;
}) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: record.exerciseId },
  });
  if (!exercise || !exercise.isPBTrackable) return;

  const pbValue = calculatePBValue(record, exercise.unit);

  const existingPB = await prisma.personalBest.findUnique({
    where: {
      athleteId_exerciseId: {
        athleteId: record.athleteId,
        exerciseId: record.exerciseId,
      },
    },
  });

  if (existingPB) {
    if (pbValue > existingPB.value) {
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
}

export async function listPersonalBests(params: ListPersonalBestsParams) {
  const { athleteId, exerciseId, category, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;
  if (exerciseId) where.exerciseId = exerciseId;
  if (category) where.exercise = { is: { category } };

  const [records, total] = await Promise.all([
    prisma.personalBest.findMany({
      where,
      include: {
        athlete: { select: { id: true, name: true } },
        exercise: { select: { id: true, name: true, category: true, unit: true } },
      },
      orderBy: [{ value: 'desc' }, { achievedDate: 'desc' }],
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
  // 获取所有可追踪 PB 的练习（含单位）
  const exercises = await prisma.exercise.findMany({
    where: { isPBTrackable: true },
    select: { id: true, unit: true },
  });
  const exerciseMap = new Map(exercises.map((e) => [e.id, e.unit]));

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
      trainingDate: true,
    },
  });

  // 按 (athleteId, exerciseId) 分组，找出每组中 PB 值最大的记录
  const bestMap = new Map<string, PBBestEntry>();

  for (const record of trainingRecords) {
    const unit = exerciseMap.get(record.exerciseId) || '';
    const value = calculatePBValue(record, unit);
    if (value <= 0) continue;

    const key = `${record.athleteId}-${record.exerciseId}`;
    const existing = bestMap.get(key);
    if (!existing || value > existing.value) {
      bestMap.set(key, {
        value,
        recordId: record.id,
        achievedDate: record.trainingDate,
        unit,
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
