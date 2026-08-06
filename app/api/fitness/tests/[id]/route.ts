/**
 * 体能测试项目 API —— /api/fitness/tests/[id]
 *
 * GET: 获取单个体能测试项目
 * PUT: 更新体能测试项目
 * DELETE: 删除体能测试项目
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getFitnessTestById,
  updateFitnessTest,
  deleteFitnessTest,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessTestUpdateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试项目ID');
    }

    const test = await getFitnessTestById(id);
    return Response.json({ success: true, data: test });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试项目ID');
    }

    const body = await request.json();
    const parsed = fitnessTestUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const test = await updateFitnessTest(id, parsed.data);
    return Response.json({ success: true, data: test });
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
      throw new ValidationError('无效的测试项目ID');
    }

    await deleteFitnessTest(id);
    return Response.json({ success: true, data: null });
  } catch (error) {
    return handleRouteError(error);
  }
}
