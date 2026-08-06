/**
 * 伤病管理业务服务 —— 伤病与负荷监控模块（AMS）
 *
 * 职责：
 * 1. 伤病记录 CRUD
 * 2. 康复计划 CRUD
 * 3. 健康指标（心率/睡眠/RPE/HRV）记录
 *
 * 负荷监控（训练量 / ACWR）见 LoadService
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';

// ============================================================
// 类型定义
// ============================================================
export interface CreateInjuryInput {
  athleteId: number;
  injuryType: string;
  description: string;
  startDate: string;
  endDate?: string | null;
  status?: string;
}

export interface CreateRecoveryPlanInput {
  injuryId: number;
  content: string;
  startDate: string;
  targetReturnDate: string;
}

export interface CreateHealthMetricInput {
  athleteId: number;
  metricType: string;
  value: number;
  unit: string;
  recordedAt: string;
  source?: string;
}

// ============================================================
// 伤病记录
// ============================================================

export async function createInjury(data: CreateInjuryInput, operatorId: number) {
  const athlete = await prisma.athlete.findUnique({ where: { id: data.athleteId } });
  if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');

  const injury = await prisma.injury.create({
    data: {
      athleteId: data.athleteId,
      injuryType: data.injuryType,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: (data.status || 'INJURED') as 'INJURED' | 'RECOVERING' | 'RETURNED',
      recordedById: operatorId,
    },
    include: {
      athlete: { select: { id: true, name: true } },
      recoveryPlan: true,
    },
  });

  if (athlete.status === 'ACTIVE') {
    await prisma.athlete.update({
      where: { id: data.athleteId },
      data: { status: 'RECOVERING' },
    });
  }

  await logAction({
    userId: operatorId,
    action: 'CREATE_INJURY',
    targetType: 'Injury',
    targetId: injury.id,
    detail: { athleteId: data.athleteId, injuryType: data.injuryType },
  });

  return injury;
}

export async function updateInjury(
  id: number,
  data: Partial<CreateInjuryInput>,
  operatorId: number
) {
  const existing = await prisma.injury.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '伤病记录不存在');

  const updateData: Record<string, unknown> = {};
  if (data.injuryType) updateData.injuryType = data.injuryType;
  if (data.description) updateData.description = data.description;
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'RETURNED') {
      await prisma.athlete.update({
        where: { id: existing.athleteId },
        data: { status: 'ACTIVE' },
      });
    }
  }

  const injury = await prisma.injury.update({
    where: { id },
    data: updateData,
    include: { athlete: { select: { id: true, name: true } }, recoveryPlan: true },
  });

  await logAction({
    userId: operatorId,
    action: 'UPDATE_INJURY',
    targetType: 'Injury',
    targetId: id,
  });

  return injury;
}

export async function listInjuries(params: {
  athleteId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, status, page = 1, pageSize = 20 } = params;
  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;
  if (status) where.status = status;

  const [injuries, total] = await Promise.all([
    prisma.injury.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { athlete: { select: { id: true, name: true } }, recoveryPlan: true },
    }),
    prisma.injury.count({ where }),
  ]);

  return { injuries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============================================================
// 康复计划
// ============================================================

export async function createRecoveryPlan(data: CreateRecoveryPlanInput) {
  const injury = await prisma.injury.findUnique({ where: { id: data.injuryId } });
  if (!injury) throw new BusinessError('NOT_FOUND', '伤病记录不存在');

  const existing = await prisma.recoveryPlan.findUnique({ where: { injuryId: data.injuryId } });
  if (existing) throw new BusinessError('DUPLICATE', '该伤病已有康复计划');

  return prisma.recoveryPlan.create({
    data: {
      injuryId: data.injuryId,
      content: data.content,
      startDate: new Date(data.startDate),
      targetReturnDate: new Date(data.targetReturnDate),
    },
  });
}

export async function getRecoveryPlanByInjury(injuryId: number) {
  return prisma.recoveryPlan.findUnique({ where: { injuryId } });
}

// ============================================================
// 健康指标
// ============================================================

export async function createHealthMetric(data: CreateHealthMetricInput, operatorId?: number) {
  const athlete = await prisma.athlete.findUnique({ where: { id: data.athleteId } });
  if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');

  return prisma.healthMetric.create({
    data: {
      athleteId: data.athleteId,
      metricType: data.metricType as 'HEART_RATE' | 'SLEEP' | 'RPE' | 'HRV',
      value: data.value,
      unit: data.unit,
      recordedAt: new Date(data.recordedAt),
      source: (data.source || 'MANUAL') as 'MANUAL' | 'POLAR',
      recordedById: operatorId ?? null,
    },
  });
}

export async function listHealthMetrics(params: {
  athleteId: number;
  metricType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, metricType, startDate, endDate, page = 1, pageSize = 30 } = params;
  const where: Record<string, unknown> = { athleteId };
  if (metricType) where.metricType = metricType;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.recordedAt = dateFilter;
  }

  const [metrics, total] = await Promise.all([
    prisma.healthMetric.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.healthMetric.count({ where }),
  ]);

  return { metrics, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
