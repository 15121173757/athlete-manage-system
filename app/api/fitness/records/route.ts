/**
 * 体能测试记录 API —— /api/fitness/records
 *
 * GET: 分页查询体能测试记录
 * POST: 上报体能测试记录
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listFitnessRecords,
  createFitnessRecord,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessRecordCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId') ? parseInt(searchParams.get('athleteId')!) : undefined;
    const testId = searchParams.get('testId') ? parseInt(searchParams.get('testId')!) : undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await listFitnessRecords({ athleteId, testId, startDate, endDate, page, pageSize });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.FITNESS_WRITE);
    const body = await request.json();
    const parsed = fitnessRecordCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await createFitnessRecord(parsed.data, user.userId);
    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
