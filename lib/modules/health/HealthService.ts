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
import path from 'node:path';
import fs from 'node:fs';

// ============================================================
// 类型定义
// ============================================================
export interface CreateInjuryInput {
  athleteId: number;
  injuryType: string;
  description: string;
  bodyPart: string;
  cause: string;
  diagnosis: string;
  treatment: string;
  startDate: string;
  endDate?: string | null;
  status?: string;
  /** 更新时的变更备注（创建时忽略） */
  note?: string;
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

/** 字符串字段去除首尾空白，空串归一化为 null */
function normalizeField(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

export async function createInjury(data: CreateInjuryInput, operatorId: number) {
  const athlete = await prisma.athlete.findUnique({ where: { id: data.athleteId } });
  if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');

  const injury = await prisma.injury.create({
    data: {
      athleteId: data.athleteId,
      injuryType: data.injuryType,
      description: data.description,
      bodyPart: data.bodyPart,
      cause: data.cause,
      diagnosis: data.diagnosis,
      treatment: data.treatment,
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

  await logAction({
    userId: operatorId,
    action: 'CREATE_INJURY',
    targetType: 'Injury',
    targetId: injury.id,
    detail: { athleteId: data.athleteId, injuryType: data.injuryType },
  });

  return injury;
}

export async function getInjuryById(id: number) {
  return prisma.injury.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, name: true, sport: true, position: true } },
      recoveryPlan: true,
      history: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { operator: { select: { id: true, name: true, username: true } } },
      },
    },
  });
}

export async function updateInjury(
  id: number,
  data: Partial<CreateInjuryInput>,
  operatorId: number
) {
  const existing = await prisma.injury.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '伤病记录不存在');

  const updateData: Record<string, unknown> = {};
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  // 字符串字段
  const stringFields = [
    'injuryType',
    'description',
    'bodyPart',
    'cause',
    'diagnosis',
    'treatment',
  ] as const;
  for (const field of stringFields) {
    if (data[field] !== undefined) {
      const value = normalizeField(data[field]);
      updateData[field] = value;
      if (existing[field] !== value) {
        changes[field] = { before: existing[field], after: value };
      }
    }
  }

  // 运动员
  if (data.athleteId !== undefined && data.athleteId !== existing.athleteId) {
    const athlete = await prisma.athlete.findUnique({ where: { id: data.athleteId } });
    if (!athlete) throw new BusinessError('NOT_FOUND', '运动员不存在');
    updateData.athleteId = data.athleteId;
    changes.athleteId = { before: existing.athleteId, after: data.athleteId };
  }

  // 受伤日期（按日历日比对，避免 UTC 时区偏移导致的同日噪音变更）
  if (data.startDate !== undefined) {
    const next = new Date(data.startDate).toISOString();
    updateData.startDate = new Date(next);
    if (existing.startDate.toISOString().slice(0, 10) !== next.slice(0, 10)) {
      changes.startDate = { before: existing.startDate.toISOString(), after: next };
    }
  }

  // 痊愈日期（按日历日比对）
  if (data.endDate !== undefined) {
    const after = data.endDate ? new Date(data.endDate).toISOString() : null;
    const before = existing.endDate ? existing.endDate.toISOString() : null;
    updateData.endDate = data.endDate ? new Date(after!) : null;
    if ((before === null) !== (after === null) || (before !== null && before.slice(0, 10) !== after!.slice(0, 10))) {
      changes.endDate = { before, after };
    }
  }

  // 状态
  if (data.status !== undefined && data.status !== existing.status) {
    updateData.status = data.status;
    changes.status = { before: existing.status, after: data.status };
  }

  // 无实际变更：直接返回当前记录
  if (Object.keys(changes).length === 0) {
    return prisma.injury.findUnique({
      where: { id },
      include: { athlete: { select: { id: true, name: true } }, recoveryPlan: true },
    });
  }

  const injury = await prisma.injury.update({
    where: { id },
    data: updateData,
    include: { athlete: { select: { id: true, name: true } }, recoveryPlan: true },
  });

  // 记录修改历史（数据变更追踪）
  await prisma.injuryHistory.create({
    data: {
      injuryId: id,
      changedBy: operatorId,
      changes: JSON.stringify(changes),
      note: data.note || null,
    },
  });

  await logAction({
    userId: operatorId,
    action: 'UPDATE_INJURY',
    targetType: 'Injury',
    targetId: id,
    detail: { fields: Object.keys(changes) },
  });

  return injury;
}

/** 记录伤病附件元信息（上传时替换旧附件） */
export async function setInjuryAttachment(
  injuryId: number,
  meta: { path: string; name: string; type: string; size: number }
) {
  const existing = await prisma.injury.findUnique({ where: { id: injuryId } });
  if (!existing) throw new BusinessError('NOT_FOUND', '伤病记录不存在');

  return prisma.injury.update({
    where: { id: injuryId },
    data: {
      attachmentPath: meta.path,
      attachmentName: meta.name,
      attachmentType: meta.type,
      attachmentSize: meta.size,
    },
  });
}

/** 删除伤病记录（级联删除修改历史，清理附件文件） */
export async function deleteInjury(id: number, operatorId: number) {
  const existing = await prisma.injury.findUnique({ where: { id } });
  if (!existing) throw new BusinessError('NOT_FOUND', '伤病记录不存在');

  // 清理附件文件
  if (existing.attachmentPath) {
    try {
      const absolute = path.join(process.cwd(), 'public', existing.attachmentPath);
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    } catch {
      /* 忽略文件清理失败 */
    }
  }

  await prisma.injury.delete({ where: { id } }); // InjuryHistory 级联删除

  await logAction({
    userId: operatorId,
    action: 'DELETE_INJURY',
    targetType: 'Injury',
    targetId: id,
  });

  return { success: true };
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
