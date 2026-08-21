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
import { TestStandard } from '@/lib/fitness/test-types';
import {
  resolveFitnessPlanExecStatus,
  refreshAllFitnessPlanStatuses,
  refreshFitnessPlanStatusById,
} from './fitnessPlanStatus';

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
  standards?: TestStandard[] | null;
  precautions?: string | null;
  resultType?: string;
  gradeOptions?: string[] | null;
}

export type UpdateFitnessTestInput = Partial<CreateFitnessTestInput>;

/**
 * 将测试标准数组序列化为 JSON 字符串入库（SQLite 无 Json 列类型，以 TEXT 存储）
 */
function serializeStandards(standards: TestStandard[] | null | undefined): string | null {
  if (!standards || standards.length === 0) return null;
  return JSON.stringify(standards);
}

/**
 * 将数据库中的 standards JSON 字符串解析为数组，供 API 响应使用
 */
export function parseStandards(raw: string | null | undefined): TestStandard[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TestStandard[]) : null;
  } catch {
    return null;
  }
}

/**
 * 将等级型成绩选项数组序列化为 JSON 字符串入库
 */
function serializeGradeOptions(options: string[] | null | undefined): string | null {
  if (!options || options.length === 0) return null;
  return JSON.stringify(options);
}

/**
 * 将数据库中的 gradeOptions JSON 字符串解析为数组
 */
export function parseGradeOptions(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * 统一测试项目响应形态：解析 standards / gradeOptions 等结构化字段
 */
function serializeFitnessTest(test: {
  standards: string | null;
  gradeOptions: string | null;
  [key: string]: unknown;
}) {
  return {
    ...test,
    standards: parseStandards(test.standards),
    gradeOptions: parseGradeOptions(test.gradeOptions),
  };
}

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

  const test = await prisma.fitnessTest.create({
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
      standards: serializeStandards(data.standards),
      precautions: data.precautions ?? null,
      resultType: data.resultType || 'NUMERIC',
      gradeOptions: serializeGradeOptions(data.gradeOptions),
    },
  });
  return serializeFitnessTest(test);
}

export async function listFitnessTests() {
  const tests = await prisma.fitnessTest.findMany({ orderBy: { category: 'asc' } });
  return tests.map((t) => serializeFitnessTest(t));
}

export async function getFitnessTestById(id: number) {
  const test = await prisma.fitnessTest.findUnique({ where: { id } });
  if (!test) throw new BusinessError('NOT_FOUND', '测试项目不存在');
  return serializeFitnessTest(test);
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
  if (data.standards !== undefined) updateData.standards = serializeStandards(data.standards);
  if (data.precautions !== undefined) updateData.precautions = data.precautions;
  if (data.resultType !== undefined) updateData.resultType = data.resultType;
  if (data.gradeOptions !== undefined) updateData.gradeOptions = serializeGradeOptions(data.gradeOptions);

  const updated = await prisma.fitnessTest.update({ where: { id }, data: updateData });
  return serializeFitnessTest(updated);
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

  // 状态判定：草稿保持原状；正式创建依据执行时间与当前北京时间关系自动判定
  const isDraft = data.status === 'DRAFT';
  const status: 'DRAFT' | 'SCHEDULED' | 'COMPLETED' = isDraft
    ? 'DRAFT'
    : resolveFitnessPlanExecStatus(data.testDate, data.startTime);

  const createData: Record<string, unknown> = {
    name: data.name,
    testDate: new Date(data.testDate),
    startTime: data.startTime ?? null,
    estimatedDuration: data.estimatedDuration ?? null,
    location: data.location ?? null,
    weather: data.weather ?? null,
    venueCondition: data.venueCondition ?? null,
    notes: data.notes ?? null,
    status,
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
      status,
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

  // 实时检查：先将已过执行时间的待执行计划自动更新为已执行，保证列表状态最新
  await refreshAllFitnessPlanStatuses();

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
  // 实时检查：详情查看前刷新单条状态，确保展示状态与执行时间一致
  await refreshFitnessPlanStatusById(id);

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

  // 状态判定：
  // - 显式草稿 → 保持草稿
  // - 草稿未显式转正（未传 status）→ 保持草稿
  // - 其余（正式计划编辑或显式传 SCHEDULED/COMPLETED）→ 依据执行时间与当前北京时间自动判定
  let nextStatus: string;
  if (data.status === 'DRAFT') {
    nextStatus = 'DRAFT';
  } else if (data.status === undefined && existing.status === 'DRAFT') {
    nextStatus = 'DRAFT';
  } else {
    const effDate = data.testDate !== undefined ? data.testDate : existing.testDate;
    const effTime = data.startTime !== undefined ? data.startTime : existing.startTime;
    nextStatus = resolveFitnessPlanExecStatus(effDate, effTime);
  }
  const statusChanged = nextStatus !== existing.status;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.testDate !== undefined) updateData.testDate = new Date(data.testDate);
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.estimatedDuration !== undefined) updateData.estimatedDuration = data.estimatedDuration;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.weather !== undefined) updateData.weather = data.weather;
  if (data.venueCondition !== undefined) updateData.venueCondition = data.venueCondition;
  if (data.notes !== undefined) updateData.notes = data.notes;
  updateData.status = nextStatus;

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

  if (statusChanged) {
    await logAction({
      userId,
      action: 'FITNESS_PLAN_STATUS_CHANGE',
      targetType: 'FitnessTestPlan',
      targetId: id,
      detail: { before: existing.status, after: nextStatus, trigger: 'EDIT' },
    });
  }

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

/**
 * 发布体能测试计划：草稿 → 正式序列。
 * 校验计划完整性后，依据执行时间与当前北京时间关系自动判定为「待执行」或「已执行」。
 */
export async function publishFitnessPlan(id: number, operatorId: number) {
  const existing = await prisma.fitnessTestPlan.findUnique({
    where: { id },
    include: { items: true, participants: true },
  });
  if (!existing) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');

  if (!existing.name) {
    throw new BusinessError('VALIDATION_ERROR', '计划名称不能为空，无法发布');
  }
  if (!existing.testDate) {
    throw new BusinessError('VALIDATION_ERROR', '请先设置测试日期，无法发布');
  }
  if (existing.items.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '请至少添加一个测试项目，无法发布');
  }
  if (existing.participants.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '请至少选择一名参与运动员，无法发布');
  }

  const target = resolveFitnessPlanExecStatus(existing.testDate, existing.startTime);
  const before = existing.status;

  const plan = await prisma.fitnessTestPlan.update({
    where: { id },
    data: { status: target },
    include: planInclude,
  });

  await logAction({
    userId: operatorId,
    action: 'PUBLISH_FITNESS_PLAN',
    targetType: 'FitnessTestPlan',
    targetId: id,
    detail: { before, after: target },
  });

  return plan;
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

// ============================================================
// 体能测试成绩录入（按测试计划录入/管理成绩）
// ============================================================

export const RESULT_TYPE_NUMERIC = 'NUMERIC';
export const RESULT_TYPE_GRADE = 'GRADE';
export const RESULT_TYPE_DESCRIPTIVE = 'DESCRIPTIVE';

/** 成绩录入行：value 为原始录入文本，null / 空串表示清空该成绩 */
export interface FitnessResultRowInput {
  athleteId: number;
  testId: number;
  value: string | null;
}

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

/** 校验单条成绩值，返回 { value, gradeValue, textValue }；不合法时抛 BusinessError */
function validateResultValue(
  test: { resultType: string; gradeOptions: string | null },
  raw: string | null
): { value: number | null; gradeValue: string | null; textValue: string | null } {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return { value: null, gradeValue: null, textValue: null };
  }

  if (test.resultType === RESULT_TYPE_GRADE) {
    const options = parseGradeOptions(test.gradeOptions) ?? [];
    if (!options.includes(trimmed)) {
      throw new BusinessError('INVALID_INPUT', `等级成绩「${trimmed}」不在选项范围内（${options.join(' / ') || '未配置'}）`);
    }
    return { value: null, gradeValue: trimmed, textValue: null };
  }

  if (test.resultType === RESULT_TYPE_DESCRIPTIVE) {
    if (trimmed.length > 500) {
      throw new BusinessError('INVALID_INPUT', '描述型成绩不能超过500个字符');
    }
    return { value: null, gradeValue: null, textValue: trimmed };
  }

  // NUMERIC
  if (!NUMERIC_PATTERN.test(trimmed)) {
    throw new BusinessError('INVALID_INPUT', `数值成绩「${trimmed}」格式不正确，请输入有效数字`);
  }
  return { value: Number(trimmed), gradeValue: null, textValue: null };
}

/** 查询指定测试计划的成绩录入数据（计划 / 参与人员 / 测试项目 / 已录成绩） */
export async function getFitnessPlanResults(planId: number) {
  const plan = await prisma.fitnessTestPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        include: {
          test: { select: { id: true, name: true, unit: true, direction: true, resultType: true, gradeOptions: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      participants: {
        include: { athlete: { select: { id: true, name: true } } },
        orderBy: { athlete: { name: 'asc' } },
      },
    },
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');

  const results = await prisma.fitnessTestResult.findMany({ where: { planId } });

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      testDate: plan.testDate,
      startTime: plan.startTime,
      status: plan.status,
    },
    participants: plan.participants.map((p) => p.athlete),
    items: plan.items.map((i) => ({
      testId: i.testId,
      name: i.test.name,
      unit: i.test.unit,
      direction: i.test.direction,
      resultType: i.test.resultType,
      gradeOptions: parseGradeOptions(i.test.gradeOptions),
    })),
    results: results.map((r) => ({
      athleteId: r.athleteId,
      testId: r.testId,
      rawValue: r.rawValue,
      value: r.value,
      gradeValue: r.gradeValue,
      textValue: r.textValue,
    })),
  };
}

/**
 * 批量保存测试计划成绩：
 * - 仅「已执行」计划可录入/修改
 * - 按 计划×运动员×项目 唯一约束 upsert；value 为空表示清空该成绩
 * - 按各测试项目的成绩类型（数值/等级/描述）逐行校验
 */
export async function saveFitnessPlanResults(
  planId: number,
  rows: FitnessResultRowInput[],
  operatorId: number
) {
  const plan = await prisma.fitnessTestPlan.findUnique({
    where: { id: planId },
    include: { items: true, participants: true },
  });
  if (!plan) throw new BusinessError('NOT_FOUND', '体能测试计划不存在');
  if (plan.status !== 'COMPLETED') {
    throw new BusinessError('INVALID_STATE', '仅「已执行」的测试计划可录入成绩');
  }

  const allowedTestIds = new Set(plan.items.map((i) => i.testId));
  const allowedAthleteIds = new Set(plan.participants.map((p) => p.athleteId));

  // 去重：同一 运动员×项目 保留最后一条
  const dedup = new Map<string, FitnessResultRowInput>();
  for (const row of rows) {
    if (!allowedAthleteIds.has(row.athleteId)) {
      throw new BusinessError('INVALID_INPUT', '存在不属于该测试计划的参与人员');
    }
    if (!allowedTestIds.has(row.testId)) {
      throw new BusinessError('INVALID_INPUT', '存在不属于该测试计划的测试项目');
    }
    dedup.set(`${row.athleteId}_${row.testId}`, row);
  }

  const tests = await prisma.fitnessTest.findMany({
    where: { id: { in: [...allowedTestIds] } },
    select: { id: true, resultType: true, gradeOptions: true },
  });
  const testMeta = new Map(tests.map((t) => [t.id, t]));

  // 逐行校验并分类：upsert / delete
  const toUpsert: { athleteId: number; testId: number; rawValue: string; value: number | null; gradeValue: string | null; textValue: string | null }[] = [];
  const toDelete: { athleteId: number; testId: number }[] = [];

  for (const row of dedup.values()) {
    const meta = testMeta.get(row.testId);
    if (!meta) throw new BusinessError('NOT_FOUND', '测试项目不存在');

    const parsed = validateResultValue(meta, row.value);
    const raw = row.value?.trim() ?? '';
    if (!raw) {
      toDelete.push({ athleteId: row.athleteId, testId: row.testId });
    } else {
      toUpsert.push({ athleteId: row.athleteId, testId: row.testId, rawValue: raw, ...parsed });
    }
  }

  await prisma.$transaction([
    ...toDelete.map((k) =>
      prisma.fitnessTestResult.deleteMany({
        where: { planId, athleteId: k.athleteId, testId: k.testId },
      })
    ),
    ...toUpsert.map((row) =>
      prisma.fitnessTestResult.upsert({
        where: {
          planId_athleteId_testId: {
            planId,
            athleteId: row.athleteId,
            testId: row.testId,
          },
        },
        create: {
          planId,
          athleteId: row.athleteId,
          testId: row.testId,
          rawValue: row.rawValue,
          value: row.value,
          gradeValue: row.gradeValue,
          textValue: row.textValue,
          recordedById: operatorId,
        },
        update: {
          rawValue: row.rawValue,
          value: row.value,
          gradeValue: row.gradeValue,
          textValue: row.textValue,
          recordedById: operatorId,
        },
      })
    ),
  ]);

  await logAction({
    userId: operatorId,
    action: 'RECORD_FITNESS_RESULTS',
    targetType: 'FitnessTestPlan',
    targetId: planId,
    detail: { planName: plan.name, saved: toUpsert.length, cleared: toDelete.length },
  });

  return { saved: toUpsert.length, cleared: toDelete.length };
}

// ============================================================
// 运动能力分析（按 运动员 × 素质类别 查询成绩与常模）
// ============================================================

/** 分析用测试条目：数值成绩 + 可选常模（standards） */
export interface AbilityTestItem {
  testId: number;
  name: string;
  unit: string;
  direction: string;
  /** 数值成绩（NUMERIC 测试的最新一条） */
  value: number;
  rawValue: string;
  /** 该测试的常模选项（由测试标准 standards 提供，可能为空） */
  norms: TestStandard[] | null;
}

/**
 * 查询某运动员已完成的所有数值型测试及其最新成绩（可选按素质类别过滤），
 * 附带各测试的常模选项并按类别分组，供运动能力分析选择使用。
 */
export async function getAthleteAnalysisData(athleteId: number, category?: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, name: true, sport: true },
  });
  if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');

  const results = await prisma.fitnessTestResult.findMany({
    where: {
      athleteId,
      ...(category ? { test: { category } } : {}),
    },
    include: {
      test: { select: { id: true, name: true, category: true, unit: true, direction: true, resultType: true, standards: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // 同一测试取最新一条成绩，仅保留数值型且有成绩的记录
  const seen = new Set<number>();
  const byCategory = new Map<string, AbilityTestItem[]>();
  for (const r of results) {
    if (seen.has(r.testId)) continue;
    seen.add(r.testId);
    if (r.test.resultType !== RESULT_TYPE_NUMERIC || r.value === null) continue;
    const item: AbilityTestItem = {
      testId: r.test.id,
      name: r.test.name,
      unit: r.test.unit,
      direction: r.test.direction,
      value: r.value,
      rawValue: r.rawValue ?? '',
      norms: parseStandards(r.test.standards),
    };
    const list = byCategory.get(r.test.category) || [];
    list.push(item);
    byCategory.set(r.test.category, list);
  }

  const groups = [...byCategory.entries()].map(([cat, items]) => ({ category: cat, items }));

  return {
    athlete: { id: athlete.id, name: athlete.name, sport: athlete.sport },
    groups,
  };
}
