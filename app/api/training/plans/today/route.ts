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
    // 以本地日期作为「今日」，匹配执行开始日期为今日的训练计划
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const result = await listTodayPlanAthletes(dateStr);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
