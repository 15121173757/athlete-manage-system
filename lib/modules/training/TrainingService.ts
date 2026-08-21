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
import {
  resolvePlanExecStatus,
  refreshAllPlanStatuses,
  refreshPlanStatusById,
  syncCompletedPlanRecords,
} from './planStatus';

// ============================================================
// 类型定义
// ============================================================

export interface CreatePlanInput {
  athleteIds: number[];
  goal?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  status?: string;
  items?: {
    athleteId?: number | null;
    exerciseId: number;
    sets: number;
    reps: number;
    load?: number | null;
    restSeconds?: number | null;
    duration?: number | null;
    tempo?: string | null;
    sortOrder?: number;
    notes?: string | null;
  }[];
}

export interface UpdatePlanInput {
  goal?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  status?: string;
  items?: {
    athleteId?: number | null;
    exerciseId: number;
    sets: number;
    reps: number;
    load?: number | null;
    restSeconds?: number | null;
    duration?: number | null;
    tempo?: string | null;
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
  metricValue?: number | null;
  trainingDate: string;
  rpe?: number | null;
  notes?: string | null;
}

// ============================================================
// 训练计划
// ============================================================

/** 'YYYY-MM-DD' → UTC 零点 Date */
function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * 计划最终状态为「已执行」时，自动生成训练记录并同步 PB。
 * 覆盖「创建/更新/发布时执行时间已过、直接判定为已执行」的边界场景
 * （此类计划不经历 SCHEDULED→COMPLETED 转变，不会由状态刷新触发同步）。
 * syncCompletedPlanRecords 内部有幂等保护，可安全重复调用。
 */
async function syncCompletedPlanIfNeeded(
  planId: number,
  status: string,
  operatorId: number
): Promise<void> {
  if (status !== 'COMPLETED') return;
  try {
    await syncCompletedPlanRecords(planId, operatorId);
  } catch (error) {
    console.error(`[TrainingService] 计划 ${planId} 完成数据自动记录失败`, error);
  }
}

/**
 * 校验练习项与运动员的关联（多运动员独立配置）：
 * - 同一计划的练习项需统一：全部带 athleteId（独立配置）或全部为空（共享配置），避免歧义；
 * - 独立配置时，练习指定的运动员必须属于本计划；
 * - requireCoverage 为 true 时（非草稿），每位运动员至少配置一项练习。
 */
async function validatePlanItemsAthletes(
  items: { athleteId?: number | null }[],
  athleteIds: number[],
  requireCoverage = false
) {
  if (items.length === 0) return;

  const itemAthleteIds = items
    .map((i) => i.athleteId)
    .filter((id): id is number => id != null);

  if (itemAthleteIds.length > 0 && itemAthleteIds.length !== items.length) {
    throw new BusinessError('VALIDATION_ERROR', '同一计划的练习项需统一采用按运动员独立配置');
  }
  if (itemAthleteIds.length === 0) return;

  const planAthleteSet = new Set(athleteIds);
  const invalid = itemAthleteIds.filter((id) => !planAthleteSet.has(id));
  if (invalid.length > 0) {
    throw new BusinessError('VALIDATION_ERROR', '练习指定的运动员不在本计划运动员范围内');
  }

  if (requireCoverage) {
    const covered = new Set(itemAthleteIds);
    const missing = athleteIds.filter((id) => !covered.has(id));
    if (missing.length > 0) {
      throw new BusinessError('VALIDATION_ERROR', '每位运动员均需配置至少一项练习参数');
    }
  }
}

export async function createTrainingPlan(
  data: CreatePlanInput,
  coachId: number
) {
  const isDraft = data.status === 'DRAFT';

  if (data.athleteIds.length > 0) {
    const athletes = await prisma.athlete.findMany({
      where: { id: { in: data.athleteIds } },
    });
    if (athletes.length !== data.athleteIds.length) {
      throw new BusinessError('NOT_FOUND', '部分运动员不存在');
    }
  } else if (!isDraft) {
    throw new BusinessError('VALIDATION_ERROR', '请至少选择一名运动员');
  }

  // 校验：正式创建计划必须至少包含一个练习项目；草稿允许暂缺
  if ((!data.items || data.items.length === 0) && !isDraft) {
    throw new BusinessError('VALIDATION_ERROR', '请至少添加一个练习项目');
  }

  // 校验练习项目存在性：避免表单残留已删除的练习导致外键约束失败（P2003）
  if (data.items && data.items.length > 0) {
    const exerciseIds = [...new Set(data.items.map((i) => i.exerciseId))];
    const exercises = await prisma.exercise.findMany({ where: { id: { in: exerciseIds } } });
    if (exercises.length !== exerciseIds.length) {
      throw new BusinessError('EXERCISE_NOT_FOUND', '部分训练项目不存在或已被删除，请重新选择练习');
    }
  }

  // 校验练习项与运动员的关联（多运动员独立配置）；正式创建要求每位运动员均配置练习
  await validatePlanItemsAthletes(data.items ?? [], data.athleteIds, !isDraft);

  // 状态判定：草稿保持 DRAFT；正式创建依据执行时间与当前北京时间关系自动判定
  const status: 'DRAFT' | 'SCHEDULED' | 'COMPLETED' = isDraft
    ? 'DRAFT'
    : resolvePlanExecStatus(data.startDate, data.startTime);

  const createData: Record<string, unknown> = {
      coachId,
      goal: data.goal ?? null,
      startDate: data.startDate ? parseDateOnly(data.startDate) : null,
      startTime: data.startTime ?? null,
      status,
      planAthletes: {
        create: data.athleteIds.map((aid) => ({ athleteId: aid })),
      },
    };

    if (data.items && data.items.length > 0) {
      createData.items = {
        create: data.items.map((item) => ({
          athleteId: item.athleteId ?? null,
          exerciseId: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          load: item.load ?? null,
          restSeconds: item.restSeconds ?? null,
          duration: item.duration ?? null,
          tempo: item.tempo ?? null,
          sortOrder: item.sortOrder ?? 0,
          notes: item.notes ?? null,
        })),
      };
    }

    const plan = await prisma.trainingPlan.create({
      data: createData as any,
      include: {
      items: { include: { exercise: true, athlete: { select: { id: true, name: true } } } },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });

  await logAction({
    userId: coachId,
    action: 'CREATE_TRAINING_PLAN',
    targetType: 'TrainingPlan',
    targetId: plan.id,
    detail: { athleteIds: data.athleteIds, itemCount: data.items?.length ?? 0, status },
  });

  // 创建时即判定为「已执行」的计划，直接补录完成数据并同步 PB
  await syncCompletedPlanIfNeeded(plan.id, plan.status, coachId);

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
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? parseDateOnly(data.startDate) : null;
  if (data.startTime !== undefined) updateData.startTime = data.startTime;

  // 状态判定：显式回到草稿、显式发布、或编辑执行时间后按时间重算
  const effStartDate = data.startDate !== undefined
    ? (data.startDate ? data.startDate : existing.startDate)
    : existing.startDate;
  const effStartTime = data.startTime !== undefined
    ? (data.startTime ? data.startTime : existing.startTime)
    : existing.startTime;

  let nextStatus: string | undefined;
  if (data.status === 'DRAFT') {
    nextStatus = 'DRAFT';
  } else if (data.status === 'SCHEDULED' || data.status === 'COMPLETED') {
    // 显式指定非草稿状态：仍按执行时间判定，避免状态冲突
    nextStatus = resolvePlanExecStatus(effStartDate, effStartTime);
  } else if (existing.status !== 'DRAFT') {
    // 未指定状态且非草稿：编辑时按当前执行时间自动重算
    nextStatus = resolvePlanExecStatus(effStartDate, effStartTime);
  }
  if (nextStatus !== undefined) updateData.status = nextStatus;

  if (data.items) {
    // 校验练习项目存在性：避免表单残留已删除的练习导致外键约束失败（P2003）
    const exerciseIds = [...new Set(data.items.map((i) => i.exerciseId))];
    const exercises = await prisma.exercise.findMany({ where: { id: { in: exerciseIds } } });
    if (exercises.length !== exerciseIds.length) {
      throw new BusinessError('EXERCISE_NOT_FOUND', '部分训练项目不存在或已被删除，请重新选择练习');
    }

    // 校验练习项与运动员的关联（多运动员独立配置）：以计划当前已分配的运动员为准；
    // 更新后为非草稿状态时要求每位运动员均配置练习
    const planAthletes = await prisma.trainingPlanAthlete.findMany({
      where: { planId: id },
      select: { athleteId: true },
    });
    await validatePlanItemsAthletes(
      data.items,
      planAthletes.map((pa) => pa.athleteId),
      nextStatus !== 'DRAFT'
    );

    await prisma.trainingPlanItem.deleteMany({ where: { planId: id } });
    updateData.items = {
      create: data.items.map((item) => ({
        athleteId: item.athleteId ?? null,
        exerciseId: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        load: item.load ?? null,
        restSeconds: item.restSeconds ?? null,
        duration: item.duration ?? null,
        tempo: item.tempo ?? null,
        sortOrder: item.sortOrder ?? 0,
        notes: item.notes ?? null,
      })),
    };
  }

  const plan = await prisma.trainingPlan.update({
    where: { id },
    data: updateData,
    include: {
      items: { include: { exercise: true, athlete: { select: { id: true, name: true } } } },
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

  if (nextStatus !== undefined && existing.status !== nextStatus) {
    await logAction({
      userId: operatorId,
      action: 'PLAN_STATUS_CHANGE',
      targetType: 'TrainingPlan',
      targetId: id,
      detail: { before: existing.status, after: nextStatus, trigger: 'EDIT' },
    });
  }

  // 编辑后为「已执行」的计划，补录完成数据并同步 PB（幂等）
  await syncCompletedPlanIfNeeded(plan.id, plan.status, operatorId);

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
  // 查看详情时触发状态刷新（草稿除外）
  await refreshPlanStatusById(id);

  const plan = await prisma.trainingPlan.findUnique({
    where: { id },
    include: {
      items: {
        include: { exercise: true, athlete: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '训练计划不存在');
  return plan;
}

/**
 * 发布训练计划：校验必要执行信息完整性后，按当前北京时间与执行时间关系
 * 自动判定为「待执行」或「已执行」，并记录状态变更日志。
 */
export async function publishTrainingPlan(id: number, operatorId: number) {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id },
    include: { items: true, planAthletes: true },
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '训练计划不存在');

  // 完整性校验：必要执行信息
  if (!plan.startDate) throw new BusinessError('VALIDATION_ERROR', '请先设置执行开始日期后再发布');
  if (!plan.startTime) throw new BusinessError('VALIDATION_ERROR', '请先设置执行开始时间后再发布');
  if (!plan.items || plan.items.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '请至少添加一个练习项目后再发布');
  }
  if (!plan.planAthletes || plan.planAthletes.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '请至少分配一名运动员后再发布');
  }

  // 多运动员独立配置校验：同一计划不允许混用共享与独立配置；独立配置时每位运动员均需覆盖
  const sharedItems = plan.items.filter((i) => i.athleteId == null);
  const perAthleteItems = plan.items.filter((i) => i.athleteId != null);
  if (perAthleteItems.length > 0 && sharedItems.length > 0) {
    throw new BusinessError('VALIDATION_ERROR', '同一计划的练习项需统一采用按运动员独立配置');
  }
  if (perAthleteItems.length > 0) {
    const covered = new Set(perAthleteItems.map((i) => i.athleteId as number));
    const missing = plan.planAthletes
      .map((pa) => pa.athleteId)
      .filter((aid) => !covered.has(aid));
    if (missing.length > 0) {
      throw new BusinessError('VALIDATION_ERROR', '每位运动员均需配置至少一项练习参数后再发布');
    }
  }

  const target = resolvePlanExecStatus(plan.startDate, plan.startTime);

  const updated = await prisma.trainingPlan.update({
    where: { id },
    data: { status: target },
    include: {
      items: {
        include: { exercise: true, athlete: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
      planAthletes: { include: { athlete: { select: { id: true, name: true } } } },
      coach: { select: { id: true, name: true } },
    },
  });

  await logAction({
    userId: operatorId,
    action: 'PUBLISH_TRAINING_PLAN',
    targetType: 'TrainingPlan',
    targetId: id,
    detail: { before: plan.status, after: target },
  });

  // 发布时即判定为「已执行」的计划，补录完成数据并同步 PB（幂等）
  await syncCompletedPlanIfNeeded(updated.id, updated.status, operatorId);

  return updated;
}

export async function listTrainingPlans(params: {
  athleteId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, status, page = 1, pageSize = 20 } = params;

  // 查看列表时触发批量状态刷新（草稿除外）
  await refreshAllPlanStatuses();

  const where: Record<string, unknown> = {};
  if (athleteId) where.planAthletes = { some: { athleteId } };
  if (status) where.status = status;

  const [plans, total] = await Promise.all([
    prisma.trainingPlan.findMany({
      where,
      // 按执行时间排列：日期越晚（越远）越靠前；无执行日期的草稿排最后
      orderBy: [{ startDate: 'desc' }, { startTime: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { include: { exercise: true, athlete: { select: { id: true, name: true } } } },
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
      items: {
        include: { exercise: true, athlete: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
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
      metricValue: data.metricValue ?? null,
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
  tempo: string | null;
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
 * 查询指定日期拥有训练计划的运动员列表
 * @param dateStr 日期（YYYY-MM-DD）
 * 判定规则：关联到状态为 SCHEDULED（待执行）的训练计划，且该计划
 * 的执行开始日期（TrainingPlan.startDate）与指定日期一致
 */
export async function listTodayPlanAthletes(dateStr: string): Promise<TodayPlansResult> {
  const date = parseDateOnly(dateStr);
  const dayOfWeek = (date.getUTCDay() + 6) % 7 + 1;

  // 查看今日计划时先刷新状态，确保「待执行/已执行」判定与当前时间一致
  await refreshAllPlanStatuses();

  const pairs = await prisma.trainingPlanAthlete.findMany({
    where: {
      plan: {
        status: 'SCHEDULED',
        startDate: date,
      },
    },
    include: {
      athlete: { select: { id: true, name: true, sport: true, position: true } },
      plan: {
        include: {
          items: {
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
    // 多运动员独立配置：仅展示属于该运动员的练习项（共享配置 athleteId 为空时展示给全员）
    const items: TodayPlanItem[] = plan.items
      .filter((it) => it.athleteId == null || it.athleteId === pair.athleteId)
      .map((it) => ({
        exerciseId: it.exercise.id,
        exerciseName: it.exercise.name,
        category: it.exercise.category,
        unit: it.exercise.unit,
        sets: it.sets,
        reps: it.reps,
        load: it.load,
        restSeconds: it.restSeconds,
        duration: it.duration,
        tempo: it.tempo,
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

// ============================================================
// 指定日期有训练计划的运动员（用于负荷录入等场景的动态筛选）
// ============================================================

/**
 * 查询指定日期当天有训练计划的运动员（去重，按姓名排序）
 * 判定规则：关联到状态为 SCHEDULED（待执行）或 COMPLETED（已执行）的训练计划，
 * 且该计划的执行开始日期落在指定日期（按「日」匹配，兼容带时分秒的存量数据）。
 */
export async function listAthletesByTrainingDate(dateStr: string) {
  const date = parseDateOnly(dateStr);
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const pairs = await prisma.trainingPlanAthlete.findMany({
    where: {
      plan: {
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        startDate: { gte: date, lt: nextDay },
      },
    },
    include: {
      athlete: { select: { id: true, name: true } },
    },
  });

  const map = new Map<number, { id: number; name: string }>();
  for (const p of pairs) {
    if (!map.has(p.athlete.id)) {
      map.set(p.athlete.id, { id: p.athlete.id, name: p.athlete.name });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-Hans-CN')
  );
}