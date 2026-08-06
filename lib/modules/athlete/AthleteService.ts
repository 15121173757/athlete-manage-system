/**
 * 运动员档案业务服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 运动员档案 CRUD
 * 2. 重复姓名校验
 * 3. 删除前关联数据检查
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';

// ============================================================
// 类型定义
// ============================================================

export interface CreateAthleteInput {
  name: string;
  gender: string;
  birthDate: string;
  height?: number | null;
  weight?: number | null;
  sport: string;
  position?: string | null;
  joinDate: string;
  photoUrl?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAthleteInput {
  name?: string;
  gender?: string;
  birthDate?: string;
  height?: number | null;
  weight?: number | null;
  sport?: string;
  position?: string | null;
  joinDate?: string;
  photoUrl?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// 创建
// ============================================================

export async function createAthlete(data: CreateAthleteInput, operatorId: number) {
  const existing = await prisma.athlete.findFirst({
    where: { name: data.name },
  });
  if (existing) {
    throw new BusinessError('DUPLICATE', `运动员「${data.name}」已存在`);
  }

  const athlete = await prisma.athlete.create({
    data: {
      name: data.name,
      gender: data.gender as 'MALE' | 'FEMALE',
      birthDate: new Date(data.birthDate),
      height: data.height ?? null,
      weight: data.weight ?? null,
      sport: data.sport,
      position: data.position ?? null,
      joinDate: new Date(data.joinDate),
      photoUrl: data.photoUrl ?? null,
      status: (data.status || 'ACTIVE') as 'ACTIVE' | 'RECOVERING' | 'LEFT',
      metadata: (data.metadata ?? {}) as any,
    },
  });

  await logAction({
    userId: operatorId,
    action: 'CREATE_ATHLETE',
    targetType: 'Athlete',
    targetId: athlete.id,
    detail: { name: data.name },
  });

  return athlete;
}

// ============================================================
// 更新
// ============================================================

export async function updateAthlete(
  id: number,
  data: UpdateAthleteInput,
  operatorId: number
) {
  const existing = await prisma.athlete.findUnique({ where: { id } });
  if (!existing) {
    throw new BusinessError('NOT_FOUND', '运动员不存在');
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await prisma.athlete.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (duplicate) {
      throw new BusinessError('DUPLICATE', `运动员「${data.name}」已存在`);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.birthDate !== undefined) updateData.birthDate = new Date(data.birthDate);
  if (data.height !== undefined) updateData.height = data.height;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.sport !== undefined) updateData.sport = data.sport;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.joinDate !== undefined) updateData.joinDate = new Date(data.joinDate);
  if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  const athlete = await prisma.athlete.update({
    where: { id },
    data: updateData,
  });

  await logAction({
    userId: operatorId,
    action: 'UPDATE_ATHLETE',
    targetType: 'Athlete',
    targetId: id,
    detail: { updatedFields: Object.keys(updateData) },
  });

  return athlete;
}

// ============================================================
// 删除
// ============================================================

export async function deleteAthlete(id: number, operatorId: number) {
  const existing = await prisma.athlete.findUnique({ where: { id } });
  if (!existing) {
    throw new BusinessError('NOT_FOUND', '运动员不存在');
  }

  const [trainingRecordCount, fitnessRecordCount, injuryCount] = await Promise.all([
    prisma.trainingRecord.count({ where: { athleteId: id } }),
    prisma.fitnessRecord.count({ where: { athleteId: id } }),
    prisma.injury.count({ where: { athleteId: id } }),
  ]);

  const relatedData: string[] = [];
  if (trainingRecordCount > 0) relatedData.push(`训练记录 ${trainingRecordCount} 条`);
  if (fitnessRecordCount > 0) relatedData.push(`体能测试记录 ${fitnessRecordCount} 条`);
  if (injuryCount > 0) relatedData.push(`伤病记录 ${injuryCount} 条`);

  if (relatedData.length > 0) {
    throw new BusinessError(
      'HAS_RELATED_DATA',
      `该运动员已关联 ${relatedData.join('、')}，无法删除`
    );
  }

  await logAction({
    userId: operatorId,
    action: 'DELETE_ATHLETE',
    targetType: 'Athlete',
    targetId: id,
    detail: { name: existing.name },
  });

  return prisma.athlete.delete({ where: { id } });
}

// ============================================================
// 查询单条
// ============================================================

export async function getAthlete(id: number) {
  const athlete = await prisma.athlete.findUnique({
    where: { id },
    include: {
      planAthletes: { take: 5, orderBy: { id: 'desc' }, include: { plan: true } },
      personalBests: { include: { exercise: true } },
    },
  });
  if (!athlete) {
    throw new BusinessError('NOT_FOUND', '运动员不存在');
  }
  return athlete;
}

// ============================================================
// 列表查询
// ============================================================

export async function listAthletes(params: {
  search?: string;
  gender?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search, gender, status, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sport: { contains: search } },
      { position: { contains: search } },
    ];
  }
  if (gender) where.gender = gender;
  if (status) where.status = status;

  const [athletes, total] = await Promise.all([
    prisma.athlete.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.athlete.count({ where }),
  ]);

  return { athletes, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}