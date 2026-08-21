/**
 * 练习管理 API —— /api/exercises
 *
 * GET: 列表（支持搜索、分类筛选、收藏筛选、分页）
 * POST: 创建练习
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listExercises,
  createExercise,
  listCategories,
} from '@/lib/modules/exercise/ExerciseService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { exerciseCreateSchema } from '@/lib/utils/validation';
import { logAction } from '@/lib/modules/audit/AuditService';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const difficulty = searchParams.get('difficulty') || undefined;
    const isFavorite = searchParams.has('isFavorite')
      ? searchParams.get('isFavorite') === 'true'
      : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const result = await listExercises({ search, category, difficulty, isFavorite, page, pageSize });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const body = await request.json();
    const parsed = exerciseCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const exercise = await createExercise(parsed.data);

    await logAction({
      userId: user.userId,
      action: 'CREATE_EXERCISE',
      targetType: 'Exercise',
      targetId: exercise.id,
      detail: { name: exercise.name, category: exercise.category },
    });

    return Response.json({ success: true, data: exercise }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
