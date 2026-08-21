/**
 * 体能测试计划成绩 API —— /api/fitness/plans/[id]/results
 *
 * GET: 查询指定测试计划的成绩录入数据（计划 / 参与人员 / 测试项目 / 已录成绩）
 * PUT: 批量保存测试计划成绩（仅「已执行」计划可录入/修改）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getFitnessPlanResults,
  saveFitnessPlanResults,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessResultsSaveSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const planId = parseInt(params.id);
    if (isNaN(planId)) {
      throw new ValidationError('无效的测试计划ID');
    }
    const data = await getFitnessPlanResults(planId);
    return Response.json({ success: true, data });
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
    const planId = parseInt(params.id);
    if (isNaN(planId)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const body = await request.json();
    const parsed = fitnessResultsSaveSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await saveFitnessPlanResults(
      planId,
      parsed.data.results,
      user.userId
    );
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
