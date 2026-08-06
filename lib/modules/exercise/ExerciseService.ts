/**
 * 练习管理服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 练习 CRUD 操作
 * 2. 搜索与分类筛选
 * 3. 收藏切换
 */

import { prisma } from '@/lib/db/prisma';

export interface ListExercisesParams {
  search?: string;
  category?: string;
  difficulty?: string;
  isFavorite?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateExerciseInput {
  name: string;
  category: string;
  unit: string;
  description?: string | null;
  difficulty?: string | null;
  targetMuscles?: string | null;
  equipment?: string | null;
  demoImageUrl?: string | null;
  demoVideoUrl?: string | null;
  isFavorite?: boolean;
  sortOrder?: number;
  isPBTrackable?: boolean;
}

export interface UpdateExerciseInput extends Partial<CreateExerciseInput> {}

// ============================================================
// 列表查询
// ============================================================

export async function listExercises(params: ListExercisesParams) {
  const { search, category, difficulty, isFavorite, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { targetMuscles: { contains: search } },
      { equipment: { contains: search } },
    ];
  }
  if (category) where.category = category;
  if (difficulty) where.difficulty = difficulty;
  if (isFavorite !== undefined) where.isFavorite = isFavorite;

  const [exercises, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      orderBy: [
        { isFavorite: 'desc' },
        { sortOrder: 'asc' },
        { category: 'asc' },
        { name: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.exercise.count({ where }),
  ]);

  return {
    exercises,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// 详情
// ============================================================

export async function getExerciseById(id: number) {
  return prisma.exercise.findUnique({ where: { id } });
}

// ============================================================
// 创建
// ============================================================

export async function createExercise(data: CreateExerciseInput) {
  return prisma.exercise.create({ data });
}

// ============================================================
// 更新
// ============================================================

export async function updateExercise(id: number, data: UpdateExerciseInput) {
  return prisma.exercise.update({ where: { id }, data });
}

// ============================================================
// 删除
// ============================================================

export async function deleteExercise(id: number) {
  // 检查是否有关联数据
  const [planItemCount, recordCount] = await Promise.all([
    prisma.trainingPlanItem.count({ where: { exerciseId: id } }),
    prisma.trainingRecord.count({ where: { exerciseId: id } }),
  ]);

  if (planItemCount > 0 || recordCount > 0) {
    throw new Error(`该练习已被 ${planItemCount} 个计划项和 ${recordCount} 条训练记录引用，无法删除`);
  }

  return prisma.exercise.delete({ where: { id } });
}

// ============================================================
// 收藏切换
// ============================================================

export async function toggleFavorite(id: number) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) throw new Error('练习不存在');

  return prisma.exercise.update({
    where: { id },
    data: { isFavorite: !exercise.isFavorite },
  });
}

// ============================================================
// 获取所有分类（用于筛选下拉）
// ============================================================

export async function listCategories() {
  const result = await prisma.exercise.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return result.map((r) => r.category);
}
