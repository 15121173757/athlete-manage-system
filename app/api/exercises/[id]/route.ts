/**
 * 练习详情 API —— /api/exercises/[id]
 *
 * GET: 详情
 * PUT: 更新
 * DELETE: 删除
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getExerciseById,
  updateExercise,
  deleteExercise,
} from '@/lib/modules/exercise/ExerciseService';
import { ValidationError, NotFoundError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { exerciseUpdateSchema } from '@/lib/utils/validation';
import { logAction } from '@/lib/modules/audit/AuditService';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const exercise = await getExerciseById(parseInt(params.id));
    if (!exercise) throw new NotFoundError('练习不存在');
    return Response.json({ success: true, data: exercise });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const body = await request.json();
    const parsed = exerciseUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const id = parseInt(params.id);
    const before = await getExerciseById(id);
    if (!before) throw new NotFoundError('练习不存在');

    const exercise = await updateExercise(id, parsed.data);

    await logAction({
      userId: user.userId,
      action: 'UPDATE_EXERCISE',
      targetType: 'Exercise',
      targetId: id,
      detail: { before: { name: before.name, category: before.category }, after: { name: exercise.name, category: exercise.category } },
    });

    return Response.json({ success: true, data: exercise });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const id = parseInt(params.id);
    const before = await getExerciseById(id);
    if (!before) throw new NotFoundError('练习不存在');

    await deleteExercise(id);

    await logAction({
      userId: user.userId,
      action: 'DELETE_EXERCISE',
      targetType: 'Exercise',
      targetId: id,
      detail: { name: before.name, category: before.category },
    });

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
