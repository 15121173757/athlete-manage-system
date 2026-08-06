/**
 * 健康指标 API —— /api/health/metrics
 *
 * GET: 查询健康指标
 * POST: 记录健康指标
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listHealthMetrics,
  createHealthMetric,
} from '@/lib/modules/health/HealthService';
import { healthMetricCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId') ? parseInt(searchParams.get('athleteId')!) : undefined;
    const metricType = searchParams.get('metricType') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (!athleteId) {
      return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 athleteId 参数' } }, { status: 400 });
    }

    const result = await listHealthMetrics({ athleteId, metricType, startDate, endDate });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.HEALTH_WRITE);
    const body = await request.json();
    const parsed = healthMetricCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const metric = await createHealthMetric(parsed.data, user.userId);
    return Response.json({ success: true, data: metric }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
