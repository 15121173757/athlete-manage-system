/**
 * 运动员负荷详情 API —— /api/health/load/[athleteId]
 *
 * GET: 单个运动员近 28 天负荷明细（含 EWMA 急性/慢性负荷与 ACWR）+ 近期负荷记录
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getAthleteLoadDetail,
  listLoadRecords,
} from '@/lib/modules/health/LoadService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const athleteId = parseInt(params.athleteId, 10);
    if (isNaN(athleteId)) {
      throw new ValidationError('无效的运动员 ID');
    }

    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const [detail, list] = await Promise.all([
      getAthleteLoadDetail(athleteId),
      listLoadRecords({ athleteId, page: 1, pageSize }),
    ]);

    return Response.json({
      success: true,
      data: {
        ...detail,
        records: list.records,
        recordTotal: list.total,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
