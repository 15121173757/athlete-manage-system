/**
 * 体能测试业务服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 体能测试项目（FitnessTest）CRUD
 * 2. 体能测试计划（FitnessTestPlan）CRUD 及器材汇总
 * 3. 体能测试记录（FitnessRecord）上报与查询
 * 4. 趋势分析基础计算
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';

// ============================================================
// 类型定义
// ============================================================
export interface CreateFitnessTestInput {
  name: string;
  category: string;
  unit: string;
  direction?: string | null;
  warningThreshold?: number | null;
  description?: string | null;
  purpose?: string | null;
  applicableGroup?: string | null;
  equipment?: string | null;
  demoVideoUrl?: string | null;
  diagramUrl?: string | null;
  scoringStandard?: string | null;
  referenceRange?: string | null;
  precautions?: string | null;
}

export type UpdateFitnessTestInput = Partial<CreateFitnessTestInput>;

export interface CreateRecordInput {
  athleteId: number;
  testId: number;
  value: number;
  testDate: string;
}

export interface FitnessPlanItemInput {
  testId: number;
  sortOrder?: number;
  groupName?: string | null;
  allocatedMinutes?: number | null;
}

export interface CreateFitnessPlanInput {
  name: string;
  testDate: string;
  startTime?: string | null;
  estimatedDuration?: number | null;
  location?: string | null;
  weather?: string | null;
  venueCondition?: string | null;
  notes?: string | null;
  status?: string;
  items?: FitnessPlanItemInput[];
  participantIds?: number[];
}

export type UpdateFitnessPlanInput = Partial<CreateFitnessPlanInput>;

// ============================================================
// 体能测试项目
// ============================================================

export async function createFitnessTest(data: CreateFitnessTestInput) {
  const existing = await prisma.fitnessTest.findUnique({ where: { name: data.name } });
  if (existing) throw new BusinessError('DUPLICATE', `测试项目「${data.name}」已存在`);

  return prisma.fitnessTest.create({
    data: {
      name: data.name,
      category: data.category,
      unit: data.unit,
      direction: (data.direction || 'HIGHER_BETTER') as 'HIGHER_BETTER' | 'LOWER_BETTER',
      warningThreshold: data.warningThreshold ?? null,
      description: data.description ?? null,
      purpose: data.purpose ?? null,
      applicableGroup: data.applicableGroup ?? null,
      equipment: data.equipment ?? null,
      demoVideoUrl: data.demoVideoUrl ?? null,
      diagramUrl: data.diagramUrl ?? null,
      scoringStandard: data.scoringStandard ?? null,
      referenceRange: data.referenceRange ?? null,
      precautions: data.precautions ?? null,
    },
  });
}

export async function listFitnessTests() {
  return prisma.fitnessTest.findMany({ orderBy: { category: 'asc' } });
}

export async function getFitnessTestById(id: number) {
  const test = await prisma.fitnessTest.findUnique({ where: { id } });
  if (!test) throw new BusinessError('NOT_FOUND', '测试项目不存在');
  return test;
}

export async function updateFitnessTest(id: number, data: UpdateFitnessTestInput) {
  const existing = await prisma.fitnessTest.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '测试项目不存在');

  if (data.name && data.name !== existing.name) {
    const dup = await prisma.fitnessTest.findUnique({ where: { name: data.name } });
    if (dup) throw new BusinessError('DUPLICATE', `测试项目「${data.name}」已存在`);
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.direction !== undefined && data.direction !== null) {
    updateData.direction = data.direction;
  }
  if (data.warningThreshold !== undefined) updateData.warningThreshold = data.warningThreshold;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.purpose !== undefined) updateData.purpose = data.purpose;
  if (data.applicableGroup !== undefined) updateData.applicableGroup = data.applicableGroup;
  if (data.equipment !== undefined) updateData.equipment = data.equipment;
  if (data.demoVideoUrl !== undefined) updateData.demoVideoUrl = data.demoVideoUrl;
  if (data.diagramUrl !== undefined) updateData.diagramUrl = data.diagramUrl;
  if (data.scoringStandard !== undefined) updateData.scoringStandard = data.scoringStandard;
  if (data.referenceRange !== undefined) updateData.referenceRange = data.referenceRange;
  if (data.precautions !== undefined) updateData.precautions = data.precautions;

  return prisma.fitnessTest.update({ where: { id }, data: updateData });
}

export async function deleteFitnessTest(id: number) {
  const existing = await prisma.fitnessTest.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '测试项目不存在');

  const count = await prisma.fitnessRecord.count({ where: { testId: id } });
  if (count > 0) {
    throw new BusinessError('HAS_RELATED_DATA', `该测试项目已关联 ${count} 条记录，无法删除`);
  }

  await prisma.fitnessTest.delete({ where: { id } });
}

// ============================================================
// 体能测试计划
// ============================================================

const planInclude = {
  items: { include: { test: true }, orderBy: { sortOrder: 'asc' as const } },
  participants: { include: { athlete: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true, username: true } },
};

async function validatePlanItems(items: FitnessPlanItemInput[]) {
  const testIds = [...new Set(items.map((i) => i.testId))];
  const tests = await prisma.fitnessTest.findMany({
    where: { id: { in: testIds } },
    select: { id: true },
  });
  if (tests.length !== testIds.length) {
    throw new BusinessError('NOT_FOUND', '部分测试项目不存在');
  }
}

async function validatePlanParticipants(participantIds: number[]) {
  const athleteIds = [...new Set(participantIds)];
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds } },
    select: { id: true },
  });
  if (athletes.length !== athleteIds.length) {
    throw new BusinessError('NOT_FOUND', '部分运动员不存在');
  }
}

export async function createFitnessPlan(data: CreateFitnessPlanInput, userId: number) {
  if (data.items && data.items.length > 0) {
    await validatePlanItems(data.items);
  }
  if (data.participantIds && data.participantIds.length > 0) {
    await validatePlanParticipants(data.participantIds);
  }

  const createData: Record<string, unknown> = {
    name: data.name,
    testDate: new Date(data.testDate),
    startTime: data.startTime ?? null,
    estimatedDuration: data.estimatedDuration ?? null,
    location: data.location ?? null,
    weather: data.weather ?? null,
    venueCondition: data.venueCondition ?? null,
    notes: data.notes ?? null,
    status: (data.status || 'DRAFT') as 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
    createdById: userId,
  };

  if (data.items && data.items.length > 0) {
    createData.items = {
      create: data.items.map((item) => ({
        testId: item.testId,
        sortOrder: item.sortOrder ?? 0,
        groupName: item.groupName ?? null,
        allocatedMinutes: item.allocatedMinutes ?? null,
      })),
    };
  }

  if (data.participantIds && data.participantIds.length > 0) {
    const uniqueIds = [...new Set(data.participantIds)];
    createData.participants = {
      create: uniqueIds.map((athleteId) => ({ athleteId })),
    };
  }

  const plan = await prisma.fitnessTestPlan.create({
    data: createData as any,
    include: planInclude,
  });

  await logAction({
    userId,
    action: 'CREATE_FITNESS_PLAN',
    targetType: 'FitnessTestPlan',
    targetId: plan.id,
    detail: {
      name: data.name,
      itemCount: data.items?.length ?? 0,
      participantCount: data.participantIds?.length ?? 0,
    },
  });

  return plan;
}

export async function listFitnessPlans(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [plans, total] = await Promise.all([
    prisma.fitnessTestPlan.findMany({
      where,
      orderBy: { testDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: planInclude,
    }),
    prisma.fitnessTestPlan.count({ where }),
  ]);

  return { plans, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getFitnessPlan(id: number) {
  const plan = await prisma.fitnessTestPlan.findUnique({
    where: { id },
    include: planInclude,
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');
  return plan;
}

export async function updateFitnessPlan(
  id: number,
  data: UpdateFitnessPlanInput,
  userId: number
) {
  const existing = await prisma.fitnessTestPlan.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.testDate !== undefined) updateData.testDate = new Date(data.testDate);
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.estimatedDuration !== undefined) updateData.estimatedDuration = data.estimatedDuration;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.weather !== undefined) updateData.weather = data.weather;
  if (data.venueCondition !== undefined) updateData.venueCondition = data.venueCondition;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) updateData.status = data.status;

  if (data.items !== undefined) {
    if (data.items.length > 0) {
      await validatePlanItems(data.items);
    }
    await prisma.fitnessTestPlanItem.deleteMany({ where: { planId: id } });
    if (data.items.length > 0) {
      updateData.items = {
        create: data.items.map((item) => ({
          testId: item.testId,
          sortOrder: item.sortOrder ?? 0,
          groupName: item.groupName ?? null,
          allocatedMinutes: item.allocatedMinutes ?? null,
        })),
      };
    }
  }

  if (data.participantIds !== undefined) {
    if (data.participantIds.length > 0) {
      await validatePlanParticipants(data.participantIds);
    }
    await prisma.fitnessTestPlanParticipant.deleteMany({ where: { planId: id } });
    if (data.participantIds.length > 0) {
      const uniqueIds = [...new Set(data.participantIds)];
      updateData.participants = {
        create: uniqueIds.map((athleteId) => ({ athleteId })),
      };
    }
  }

  const plan = await prisma.fitnessTestPlan.update({
    where: { id },
    data: updateData,
    include: planInclude,
  });

  await logAction({
    userId,
    action: 'UPDATE_FITNESS_PLAN',
    targetType: 'FitnessTestPlan',
    targetId: id,
  });

  return plan;
}

export async function deleteFitnessPlan(id: number) {
  const existing = await prisma.fitnessTestPlan.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');

  return prisma.fitnessTestPlan.delete({ where: { id } });
}

export async function getEquipmentSummary(planId: number) {
  const plan = await prisma.fitnessTestPlan.findUnique({
    where: { id: planId },
    include: { items: { include: { test: true } } },
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');

  const summary = new Map<string, { name: string; count: number; ready: boolean }>();

  for (const item of plan.items) {
    const equipmentStr = item.test.equipment;
    if (!equipmentStr) continue;
    const names = equipmentStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of names) {
      const entry = summary.get(name);
      if (entry) {
        entry.count += 1;
        entry.ready = entry.ready && item.equipmentReady;
      } else {
        summary.set(name, { name, count: 1, ready: item.equipmentReady });
      }
    }
  }

  return Array.from(summary.values());
}

// ============================================================
// 体能测试记录
// ============================================================

export async function createFitnessRecord(data: CreateRecordInput, operatorId: number) {
  const [athlete, test] = await Promise.all([
    prisma.athlete.findUnique({ where: { id: data.athleteId } }),
    prisma.fitnessTest.findUnique({ where: { id: data.testId } }),
  ]);
  if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');
  if (!test) throw new BusinessError('NOT_FOUND', '测试项目不存在');

  let warning: string | null = null;
  if (test.warningThreshold !== null && test.warningThreshold !== undefined) {
    const isLowerBetter = test.direction === 'LOWER_BETTER';
    const isWarning = isLowerBetter
      ? data.value > test.warningThreshold
      : data.value < test.warningThreshold;
    if (isWarning) {
      warning = `数值 ${data.value}${test.unit} 超出安全阈值 ${test.warningThreshold}${test.unit}`;
    }
  }

  const record = await prisma.fitnessRecord.create({
    data: {
      athleteId: data.athleteId,
      testId: data.testId,
      value: data.value,
      testDate: new Date(data.testDate),
      recordedById: operatorId,
    },
    include: { test: true, athlete: { select: { id: true, name: true } } },
  });

  await logAction({
    userId: operatorId,
    action: 'CREATE_FITNESS_RECORD',
    targetType: 'FitnessRecord',
    targetId: record.id,
    detail: { athleteId: data.athleteId, testId: data.testId, value: data.value },
  });

  return { record, warning };
}

export interface BatchCreateRecordInput {
  athleteId: number;
  testId: number;
  value: number;
  testDate: string;
  notes?: string | null;
}

export async function batchCreateFitnessRecords(data: BatchCreateRecordInput[], operatorId: number) {
  const results: { success: boolean; index: number; error?: string; record?: unknown }[] = [];
  const validRecords: typeof data = [];

  // Validate all records first
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.athleteId || !item.testId || item.value === undefined || item.value === null) {
      results.push({ success: false, index: i, error: '缺少必填字段（运动员ID、测试项目ID、数值）' });
      continue;
    }
    if (!item.testDate) {
      results.push({ success: false, index: i, error: '缺少测试日期' });
      continue;
    }
    validRecords.push(item);
  }

  // Check existence for valid records
  const athleteIds = [...new Set(validRecords.map((r) => r.athleteId))];
  const testIds = [...new Set(validRecords.map((r) => r.testId))];

  const [athletes, tests] = await Promise.all([
    prisma.athlete.findMany({ where: { id: { in: athleteIds } }, select: { id: true } }),
    prisma.fitnessTest.findMany({ where: { id: { in: testIds } }, select: { id: true, direction: true, warningThreshold: true, unit: true } }),
  ]);

  const athleteMap = new Map(athletes.map((a) => [a.id, a]));
  const testMap = new Map(tests.map((t) => [t.id, t]));

  // Create valid records
  const createdRecords = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const athlete = athleteMap.get(item.athleteId);
    const test = testMap.get(item.testId);

    if (!athlete) {
      results.push({ success: false, index: i, error: `运动员ID ${item.athleteId} 不存在` });
      continue;
    }
    if (!test) {
      results.push({ success: false, index: i, error: `测试项目ID ${item.testId} 不存在` });
      continue;
    }

    const record = await prisma.fitnessRecord.create({
      data: {
        athleteId: item.athleteId,
        testId: item.testId,
        value: item.value,
        testDate: new Date(item.testDate),
        recordedById: operatorId,
      },
    });
    createdRecords.push(record);
    results.push({ success: true, index: i, record });
  }

  if (createdRecords.length > 0) {
    await logAction({
      userId: operatorId,
      action: 'BATCH_CREATE_FITNESS_RECORD',
      targetType: 'FitnessRecord',
      targetId: createdRecords[0].id,
      detail: { count: createdRecords.length },
    });
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return {
    successCount,
    failCount,
    total: data.length,
    results,
  };
}

export async function listFitnessRecords(params: {
  athleteId?: number;
  testId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, testId, startDate, endDate, page = 1, pageSize = 20 } = params;
  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;
  if (testId) where.testId = testId;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.testDate = dateFilter;
  }

  const [records, total] = await Promise.all([
    prisma.fitnessRecord.findMany({
      where,
      orderBy: { testDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { test: true, athlete: { select: { id: true, name: true } } },
    }),
    prisma.fitnessRecord.count({ where }),
  ]);

  return { records, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getFitnessTrend(athleteId: number, testId: number) {
  return prisma.fitnessRecord.findMany({
    where: { athleteId, testId },
    orderBy: { testDate: 'asc' },
    select: { value: true, testDate: true },
  });
}
