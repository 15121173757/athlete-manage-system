import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { listAthletesByTrainingDate } from '@/lib/modules/training/TrainingService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

/**
 * GET /api/training/plans/athletes?date=YYYY-MM-DD
 * 查询指定日期当天有训练计划的运动员（用于负荷录入等动态筛选）
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) throw new ValidationError('缺少日期参数');

    const athletes = await listAthletesByTrainingDate(date);
    return Response.json({ success: true, data: { athletes } });
  } catch (error) {
    return handleRouteError(error);
  }
}
