/**
 * 体能测试计划 API —— /api/fitness/plans/[id]
 *
 * GET: 获取单个体能测试计划
 * PUT: 更新体能测试计划
 * DELETE: 删除体能测试计划
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getFitnessPlan,
  updateFitnessPlan,
  deleteFitnessPlan,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessPlanCreateSchema } from '@/lib/utils/validation';
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

    const result = await getFitnessPlan(id);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.FITNESS_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const body = await request.json();
    const parsed = fitnessPlanCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await updateFitnessPlan(id, parsed.data, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const result = await deleteFitnessPlan(id);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
