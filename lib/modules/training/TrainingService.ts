/**
 * 训练管理业务服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 训练计划 CRUD（含嵌套计划项）
 * 2. 训练记录上报与查询
 * 3. 训练项目（Exercise）列表
 * 4. 训练记录创建时自动调用 PB 更新
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';
import { updatePBOnRecord } from '@/lib/modules/pb/PBService';

// ============================================================
// 类型定义
// ============================================================

export interface CreatePlanInput {
  athleteIds: number[];
  goal?: string | null;
  status?: string;
  items?: {
    dayOfWeek: number;
    exerciseId: number;
    sets: number;
    reps: number;
    load?: number | null;
    restSeconds?: number | null;
    duration?: number | null;
    intensity?: string | null;
    sortOrder?: number;
    notes?: string | null;
  }[];
}

export interface UpdatePlanInput {
  goal?: string | null;
  status?: string;
  items?: {
    dayOfWeek: number;
    exerciseId: number;
    sets: number;
    reps: number;
    load?: number | null;
    restSeconds?: number | null;
    duration?: number | null;
    intensity?: string | null;
    sortOrder?: number;
    notes?: string | null;
  }[];
}

export interface CreateRecordInput {
  athleteId: number;
  planItemId?: number | null;
  exerciseId: number;
  actualSets: number;
  actualReps: number;
  actualLoad?: number | null;
  trainingDate: string;
  rpe?: number | null;
  notes?: string | null;
}

// ============================================================
// 训练计划
// ============================================================

export async function createTrainingPlan(
  data: CreatePlanInput,
  coachId: number
) {
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: data.athleteIds } },
  });
  if (athletes.length !== data.athleteIds.length) {
    throw new BusinessError('NOT_FOUND', '部分运动员不存在');
  }

  // 校验：创建计划必须至少包含一个练习项目，防止空计划被提交
  if (!data.items || data.items.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '请至少添加一个练习项目');
  }

  const createData: Record<string, unknown> = {
      coachId,
      goal: data.goal ?? null,
      status: (data.status || 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'COMPLETED',
      planAthletes: {
        create: data.athleteIds.map((aid) => ({ athleteId: aid })),
      },
    };

    if (data.items && data.items.length > 0) {
      createData.items = {
        create: data.items.map((item) => ({
          dayOfWeek: item.dayOfWeek,
          exerciseId: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          load: item.load ?? null,
          restSeconds: item.restSeconds ?? null,
          duration: item.duration ?? null,
          intensity: item.intensity ?? null,
          sortOrder: item.sortOrder ?? 0,
          notes: item.notes ?? null,
        })),
      };
    }

    const plan = await prisma.trainingPlan.create({
      data: createData as any,
      include: {
      items: { include: { exercise: true } },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });

  await logAction({
    userId: coachId,
    action: 'CREATE_TRAINING_PLAN',
    targetType: 'TrainingPlan',
    targetId: plan.id,
    detail: { athleteIds: data.athleteIds, itemCount: data.items?.length ?? 0 },
  });

  return plan;
}

export async function updateTrainingPlan(
  id: number,
  data: UpdatePlanInput,
  operatorId: number
) {
  const existing = await prisma.trainingPlan.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '训练计划不存在');

  const updateData: Record<string, unknown> = {};
  if (data.goal !== undefined) updateData.goal = data.goal;
  if (data.status !== undefined) updateData.status = data.status;

  if (data.items) {
    await prisma.trainingPlanItem.deleteMany({ where: { planId: id } });
    updateData.items = {
      create: data.items.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        exerciseId: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        load: item.load ?? null,
        restSeconds: item.restSeconds ?? null,
        duration: item.duration ?? null,
        intensity: item.intensity ?? null,
        sortOrder: item.sortOrder ?? 0,
        notes: item.notes ?? null,
      })),
    };
  }

  const plan = await prisma.trainingPlan.update({
    where: { id },
    data: updateData,
    include: {
      items: { include: { exercise: true } },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });

  await logAction({
    userId: operatorId,
    action: 'UPDATE_TRAINING_PLAN',
    targetType: 'TrainingPlan',
    targetId: id,
  });

  return plan;
}

export async function deleteTrainingPlan(id: number, operatorId: number) {
  const existing = await prisma.trainingPlan.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '训练计划不存在');

  await logAction({
    userId: operatorId,
    action: 'DELETE_TRAINING_PLAN',
    targetType: 'TrainingPlan',
    targetId: id,
  });

  return prisma.trainingPlan.delete({ where: { id } });
}

export async function getTrainingPlan(id: number) {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id },
    include: {
      items: { include: { exercise: true }, orderBy: { dayOfWeek: 'asc' } },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '训练计划不存在');
  return plan;
}

export async function listTrainingPlans(params: {
  athleteId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, status, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (athleteId) where.planAthletes = { some: { athleteId } };
  if (status) where.status = status;

  const [plans, total] = await Promise.all([
    prisma.trainingPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { include: { exercise: true } },
        planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
        coach: { select: { id: true, name: true } },
      },
    }),
    prisma.trainingPlan.count({ where }),
  ]);

  return { plans, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============================================================
// 计划分配：将已创建的训练计划分配给指定运动员
// ============================================================

export async function assignAthletesToPlan(
  planId: number,
  athleteIds: number[],
  operatorId: number
) {
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new BusinessError('NOT_FOUND', '训练计划不存在');

  if (athleteIds.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '请至少选择一名运动员');
  }

  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds } },
  });
  if (athletes.length !== athleteIds.length) {
    throw new BusinessError('NOT_FOUND', '部分运动员不存在');
  }

  // 先删除原有分配，再重新建立（精准分配：以本次提交为准）
  await prisma.trainingPlanAthlete.deleteMany({ where: { planId } });

  await prisma.trainingPlanAthlete.createMany({
    data: athleteIds.map((aid) => ({ planId, athleteId: aid })),
  });

  await logAction({
    userId: operatorId,
    action: 'ASSIGN_TRAINING_PLAN',
    targetType: 'TrainingPlan',
    targetId: planId,
    detail: { athleteIds },
  });

  return prisma.trainingPlan.findUnique({
    where: { id: planId },
    include: {
      items: { include: { exercise: true }, orderBy: { dayOfWeek: 'asc' } },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });
}

// ============================================================
// 训练记录
// ============================================================

export async function createTrainingRecord(
  data: CreateRecordInput,
  operatorId: number
) {
  const [athlete, exercise] = await Promise.all([
    prisma.athlete.findUnique({ where: { id: data.athleteId } }),
    prisma.exercise.findUnique({ where: { id: data.exerciseId } }),
  ]);
  if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');
  if (!exercise) throw new BusinessError('NOT_FOUND', '训练项目不存在');

  const record = await prisma.trainingRecord.create({
    data: {
      athleteId: data.athleteId,
      planItemId: data.planItemId ?? null,
      exerciseId: data.exerciseId,
      actualSets: data.actualSets,
      actualReps: data.actualReps,
      actualLoad: data.actualLoad ?? null,
      trainingDate: new Date(data.trainingDate),
      rpe: data.rpe ?? null,
      notes: data.notes ?? null,
      recordedById: operatorId,
    },
    include: {
      exercise: true,
      athlete: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await updatePBOnRecord(record);

  await logAction({
    userId: operatorId,
    action: 'CREATE_TRAINING_RECORD',
    targetType: 'TrainingRecord',
    targetId: record.id,
    detail: {
      athleteId: data.athleteId,
      exerciseId: data.exerciseId,
      value: `${data.actualSets}×${data.actualReps}${data.actualLoad ? ` @ ${data.actualLoad}kg` : ''}`,
    },
  });

  return record;
}

export async function listTrainingRecords(params: {
  athleteId?: number;
  exerciseId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, exerciseId, startDate, endDate, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;
  if (exerciseId) where.exerciseId = exerciseId;

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.trainingDate = dateFilter;
  }

  const [records, total] = await Promise.all([
    prisma.trainingRecord.findMany({
      where,
      orderBy: { trainingDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        exercise: true,
        athlete: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.trainingRecord.count({ where }),
  ]);

  return { records, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============================================================
// 训练项目
// ============================================================

export async function listExercises() {
  return prisma.exercise.findMany({
    orderBy: { category: 'asc' },
  });
}

// ============================================================
// 当日训练计划（今日计划）：统计当日有训练计划的运动员并聚合其计划明细
// ============================================================

/** 计划中的单个练习项（当日） */
export interface TodayPlanItem {
  exerciseId: number;
  exerciseName: string;
  category: string;
  unit: string;
  sets: number;
  reps: number;
  load: number | null;
  restSeconds: number | null;
  duration: number | null;
  intensity: string | null;
  notes: string | null;
}

/** 运动员当日所属的一个训练计划 */
export interface TodayPlanUnit {
  planId: number;
  goal: string | null;
  status: string;
  /** 预计总时长（分钟，当日计划项 duration 之和） */
  totalDuration: number;
  totalSets: number;
  totalReps: number;
  items: TodayPlanItem[];
}

/** 当日拥有训练计划的运动员 */
export interface TodayPlanAthlete {
  athleteId: number;
  name: string;
  sport: string;
  position: string | null;
  status: string;
  plans: TodayPlanUnit[];
}

export interface TodayPlansResult {
  date: string;
  dayOfWeek: number;
  /** 当日拥有训练计划的运动员总数（去重） */
  total: number;
  athletes: TodayPlanAthlete[];
}

/**
 * 查询当日拥有训练计划的运动员列表
 * @param dayOfWeek 星期几（1-7，1=周一）
 * 判定规则：关联到状态为 PUBLISHED（进行中）的训练计划，且该计划
 * 在指定星期存在训练安排（TrainingPlanItem.dayOfWeek 匹配）
 */
export async function listTodayPlanAthletes(dayOfWeek: number): Promise<TodayPlansResult> {
  const dateStr = new Date().toISOString().slice(0, 10);

  const pairs = await prisma.trainingPlanAthlete.findMany({
    where: {
      plan: {
        status: 'PUBLISHED',
        items: { some: { dayOfWeek } },
      },
    },
    include: {
      athlete: { select: { id: true, name: true, sport: true, position: true, status: true } },
      plan: {
        include: {
          items: {
            where: { dayOfWeek },
            include: { exercise: { select: { id: true, name: true, category: true, unit: true } } },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      },
    },
  });

  // 按运动员聚合（同一运动员可能关联多个计划）
  const byAthlete = new Map<number, TodayPlanAthlete>();
  for (const pair of pairs) {
    const plan = pair.plan;
    const items: TodayPlanItem[] = plan.items.map((it) => ({
      exerciseId: it.exercise.id,
      exerciseName: it.exercise.name,
      category: it.exercise.category,
      unit: it.exercise.unit,
      sets: it.sets,
      reps: it.reps,
      load: it.load,
      restSeconds: it.restSeconds,
      duration: it.duration,
      intensity: it.intensity,
      notes: it.notes,
    }));

    const unit: TodayPlanUnit = {
      planId: plan.id,
      goal: plan.goal,
      status: plan.status,
      totalDuration: items.reduce((s, i) => s + (i.duration ?? 0), 0),
      totalSets: items.reduce((s, i) => s + i.sets, 0),
      totalReps: items.reduce((s, i) => s + i.reps, 0),
      items,
    };

    const existing = byAthlete.get(pair.athleteId);
    if (existing) {
      existing.plans.push(unit);
    } else {
      byAthlete.set(pair.athleteId, {
        athleteId: pair.athlete.id,
        name: pair.athlete.name,
        sport: pair.athlete.sport,
        position: pair.athlete.position,
        status: pair.athlete.status,
        plans: [unit],
      });
    }
  }

  const athletes = Array.from(byAthlete.values());
  // 计划按最新创建优先，运动员按姓名排序
  athletes.forEach((a) => a.plans.sort((x, y) => y.planId - x.planId));
  athletes.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  return { date: dateStr, dayOfWeek, total: athletes.length, athletes };
}

export interface CompletedPlanItemSummary {
  planItemId: number;
  dayOfWeek: number;
  exerciseName: string;
  exerciseCategory: string;
  unit: string;
  sets: number;
  reps: number;
  load: number | null;
  duration: number | null;
  intensity: string | null;
  notes: string | null;
  /** 该运动员针对此计划项实际执行的记录次数（0 表示未执行） */
  recordCount: number;
  executedSets: number | null;
  executedReps: number | null;
}

export interface CompletedPlanRecordUnit {
  planId: number;
  planGoal: string | null;
  planStatus: string;
  /** 计划完成时间（状态置为已完成时的 updatedAt） */
  completionTime: string;
  athleteId: number;
  athleteName: string;
  athleteSport: string;
  /** 执行日期范围（取自关联训练记录，无记录则为 null） */
  executionStart: string | null;
  executionEnd: string | null;
  /** 预计总时长（分钟，计划项 duration 之和） */
  plannedDuration: number;
  exerciseCount: number;
  /** 计划内计划组/次总数（来自计划定义） */
  plannedTotalSets: number;
  plannedTotalReps: number;
  items: CompletedPlanItemSummary[];
}

export async function listCompletedPlanRecords(params: {
  athleteId?: number;
  sortBy?: 'athleteName' | 'completionTime';
  sortOrder?: 'asc' | 'desc';
}): Promise<CompletedPlanRecordUnit[]> {
  const sortBy = params.sortBy || 'completionTime';
  const sortOrder = params.sortOrder || 'desc';

  // 1. 查询所有已完成计划（可按运动员过滤）
  const plans = await prisma.trainingPlan.findMany({
    where: {
      status: 'COMPLETED',
      ...(params.athleteId ? { planAthletes: { some: { athleteId: params.athleteId } } } : {}),
    },
    include: {
      items: {
        include: { exercise: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
      planAthletes: { include: { athlete: true } },
    },
  });

  // 2. 批量取出关联这些计划的全部训练记录，避免 N+1 查询
  const itemIds = plans.flatMap((p) => p.items.map((i) => i.id));
  const records = itemIds.length
    ? await prisma.trainingRecord.findMany({
        where: { planItemId: { in: itemIds } },
        select: {
          id: true,
          athleteId: true,
          planItemId: true,
          actualSets: true,
          actualReps: true,
          trainingDate: true,
        },
      })
    : [];

  // 按 运动员 + 计划项 建立记录索引
  const recordsByAthleteItem = new Map<string, typeof records>();
  for (const r of records) {
    const key = `${r.athleteId}:${r.planItemId}`;
    const arr = recordsByAthleteItem.get(key);
    if (arr) arr.push(r);
    else recordsByAthleteItem.set(key, [r]);
  }

  // 3. 组装每个 计划 × 运动员 的单位
  const units: CompletedPlanRecordUnit[] = [];
  for (const plan of plans) {
    const planItems = plan.items;
    const plannedDuration = planItems.reduce((s, i) => s + (i.duration ?? 0), 0);
    const plannedTotalSets = planItems.reduce((s, i) => s + i.sets, 0);
    const plannedTotalReps = planItems.reduce((s, i) => s + i.reps, 0);

    for (const pa of plan.planAthletes.filter((a) => !params.athleteId || a.athleteId === params.athleteId)) {
      const athleteRecords: typeof records = [];
      const itemSummaries: CompletedPlanItemSummary[] = planItems.map((item) => {
        const recs = recordsByAthleteItem.get(`${pa.athleteId}:${item.id}`) || [];
        athleteRecords.push(...recs);
        return {
          planItemId: item.id,
          dayOfWeek: item.dayOfWeek,
          exerciseName: item.exercise.name,
          exerciseCategory: item.exercise.category,
          unit: item.exercise.unit,
          sets: item.sets,
          reps: item.reps,
          load: item.load,
          duration: item.duration,
          intensity: item.intensity,
          notes: item.notes,
          recordCount: recs.length,
          executedSets: recs.length ? recs.reduce((s, r) => s + r.actualSets, 0) : null,
          executedReps: recs.length ? recs.reduce((s, r) => s + r.actualReps, 0) : null,
        };
      });

      const timestamps = athleteRecords.map((r) => r.trainingDate.getTime());
      const minTime = timestamps.length ? Math.min(...timestamps) : null;
      const maxTime = timestamps.length ? Math.max(...timestamps) : null;

      units.push({
        planId: plan.id,
        planGoal: plan.goal,
        planStatus: plan.status,
        completionTime: plan.updatedAt.toISOString(),
        athleteId: pa.athlete.id,
        athleteName: pa.athlete.name,
        athleteSport: pa.athlete.sport,
        executionStart: minTime ? new Date(minTime).toISOString() : null,
        executionEnd: maxTime ? new Date(maxTime).toISOString() : null,
        plannedDuration,
        exerciseCount: planItems.length,
        plannedTotalSets,
        plannedTotalReps,
        items: itemSummaries,
      });
    }
  }

  // 4. 排序：按运动员姓名 或 按计划完成时间
  if (sortBy === 'athleteName') {
    units.sort((a, b) => {
      const cmp = a.athleteName.localeCompare(b.athleteName, 'zh-Hans-CN');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  } else {
    units.sort((a, b) => {
      const cmp = new Date(a.completionTime).getTime() - new Date(b.completionTime).getTime();
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }

  return units;
}