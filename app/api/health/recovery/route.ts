/**
 * 康复计划 API —— /api/health/recovery
 *
 * GET: 查询伤病的康复计划
 * POST: 创建康复计划
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  createRecoveryPlan,
  getRecoveryPlanByInjury,
} from '@/lib/modules/health/HealthService';
import { recoveryPlanCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);
    const injuryId = searchParams.get('injuryId');
    if (!injuryId) {
      return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 injuryId 参数' } }, { status: 400 });
    }

    const plan = await getRecoveryPlanByInjury(parseInt(injuryId));
    return Response.json({ success: true, data: plan });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.HEALTH_WRITE);
    const body = await request.json();
    const parsed = recoveryPlanCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const plan = await createRecoveryPlan(parsed.data);
    return Response.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
