/**
 * 训练负荷统计 API —— /api/health/load/statistics
 *
 * GET ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&sport=项目&athleteId=ID
 *   查询训练负荷统计结果（按日汇总 + 按人员汇总 + 总计）
 *   支持按日期范围、运动项目（部门）、指定运动员多维筛选
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getLoadStatistics } from '@/lib/modules/health/LoadService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);

    const athleteId = searchParams.get('athleteId')
      ? parseInt(searchParams.get('athleteId')!, 10)
      : undefined;

    const result = await getLoadStatistics({
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sport: searchParams.get('sport') || undefined,
      athleteId,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
