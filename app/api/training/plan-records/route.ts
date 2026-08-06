import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { listCompletedPlanRecords } from '@/lib/modules/training/TrainingService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

/**
 * 获取已完成训练计划记录（按 运动员 × 计划 分组）
 * 查询参数：
 * - athleteId?: number            按运动员筛选
 * - sortBy?: athleteName|completionTime   排序字段（默认 completionTime）
 * - sortOrder?: asc|desc          排序方向（默认 desc）
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);

    const athleteId = searchParams.get('athleteId')
      ? parseInt(searchParams.get('athleteId')!)
      : undefined;
    const sortBy = searchParams.get('sortBy') === 'athleteName' ? 'athleteName' : 'completionTime';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const units = await listCompletedPlanRecords({ athleteId, sortBy, sortOrder });
    return Response.json({ success: true, data: { units } });
  } catch (error) {
    return handleRouteError(error);
  }
}
