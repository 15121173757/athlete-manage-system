/**
 * 体能测试计划器材汇总 API —— /api/fitness/plans/[id]/equipment
 *
 * GET: 获取计划的器材汇总
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getEquipmentSummary } from '@/lib/modules/fitness/FitnessService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const result = await getEquipmentSummary(id);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
