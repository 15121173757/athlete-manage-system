import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getPBTrendData } from '@/lib/modules/pb/PBService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

/**
 * PB 变化趋势 API —— /api/pb/trend
 *
 * GET: 查询指定运动员在多个项目上的 PB 变化趋势时间序列。
 *
 * 查询参数：
 * - athleteId (必填)：运动员 ID
 * - exerciseIds (必填)：逗号分隔的项目 ID，1-5 个
 * - startDate (可选)：YYYY-MM-DD 起始日期
 * - endDate   (可选)：YYYY-MM-DD 结束日期
 */

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);

    const athleteIdParam = searchParams.get('athleteId');
    const exerciseIdsParam = searchParams.get('exerciseIds');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const athleteId = athleteIdParam ? parseInt(athleteIdParam) : NaN;
    if (!athleteIdParam || isNaN(athleteId)) {
      throw new ValidationError('请选择运动员');
    }

    if (!exerciseIdsParam) {
      throw new ValidationError('请选择至少一个训练项目');
    }
    const exerciseIds = exerciseIdsParam
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));

    if (exerciseIds.length === 0) {
      throw new ValidationError('无效的训练项目 ID');
    }
    if (exerciseIds.length > 5) {
      throw new ValidationError('最多同时选择 5 个项目进行对比');
    }

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new ValidationError('起始日期格式无效');
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new ValidationError('结束日期格式无效');
    }

    const result = await getPBTrendData({ athleteId, exerciseIds, startDate, endDate });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
