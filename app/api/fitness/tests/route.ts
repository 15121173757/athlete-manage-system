/**
 * 体能测试 API —— /api/fitness/tests
 *
 * GET: 获取所有体能测试项目
 * POST: 创建体能测试项目
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listFitnessTests,
  createFitnessTest,
  deleteFitnessTest,
} from '@/lib/modules/fitness/FitnessService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET() {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const tests = await listFitnessTests();
    return Response.json({ success: true, data: tests });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.FITNESS_WRITE);
    const body = await request.json();
    const test = await createFitnessTest(body);
    return Response.json({ success: true, data: test }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
