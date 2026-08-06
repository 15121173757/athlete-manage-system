/**
 * 体能测试计划 API —— /api/fitness/plans
 *
 * GET: 分页查询体能测试计划
 * POST: 创建体能测试计划
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listFitnessPlans,
  createFitnessPlan,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessPlanCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await listFitnessPlans({ status, page, pageSize });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.FITNESS_WRITE);
    const body = await request.json();
    const parsed = fitnessPlanCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await createFitnessPlan(parsed.data, user.userId);
    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
