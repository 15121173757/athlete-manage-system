/**
 * 训练计划发布 API —— /api/training/plans/[id]/publish
 *
 * POST: 将草稿计划发布，校验必要执行信息完整性后，
 *       按当前北京时间与执行时间关系自动判定为「待执行」或「已执行」。
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { publishTrainingPlan } from '@/lib/modules/training/TrainingService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);

    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的训练计划ID');
    }

    const result = await publishTrainingPlan(id, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
