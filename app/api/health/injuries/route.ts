/**
 * 伤病记录 API —— /api/health/injuries
 *
 * GET: 分页查询伤病记录
 * POST: 创建伤病记录
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listInjuries,
  createInjury,
  updateInjury,
} from '@/lib/modules/health/HealthService';
import { injuryCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId') ? parseInt(searchParams.get('athleteId')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await listInjuries({ athleteId, status, page, pageSize });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.HEALTH_WRITE);
    const body = await request.json();
    const parsed = injuryCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const injury = await createInjury(parsed.data, user.userId);
    return Response.json({ success: true, data: injury }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
