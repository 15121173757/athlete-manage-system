import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { listPBsByAthlete } from '@/lib/modules/pb/PBService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

/**
 * 运动员 PB API —— /api/pb/[athleteId]
 *
 * GET: 查询指定运动员的全部 PB 记录
 */

export async function GET(request: NextRequest, { params }: { params: { athleteId: string } }) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const athleteId = parseInt(params.athleteId);
    if (isNaN(athleteId)) throw new ValidationError('无效的运动员ID');

    const records = await listPBsByAthlete(athleteId);
    return Response.json({ success: true, data: { records } });
  } catch (error) {
    return handleRouteError(error);
  }
}
