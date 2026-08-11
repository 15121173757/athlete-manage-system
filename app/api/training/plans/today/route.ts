import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { listTodayPlanAthletes } from '@/lib/modules/training/TrainingService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

/**
 * GET /api/training/plans/today
 * 查询当日拥有训练计划的运动员列表（今日计划）
 */
export async function GET() {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    // 星期转换：getDay() 0=周日...6=周六 → dayOfWeek 1=周一...7=周日
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7 + 1;
    const result = await listTodayPlanAthletes(dayOfWeek);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
