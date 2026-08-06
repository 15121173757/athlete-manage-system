/**
 * 负荷监控 API —— /api/health/load
 *
 * GET: 运动员负荷概览（含 ACWR）+ 负荷记录分页列表
 * POST: 录入训练负荷记录（RPE × 训练时长）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  createLoadRecord,
  getLoadOverview,
  listLoadRecords,
} from '@/lib/modules/health/LoadService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);

    const athleteId = searchParams.get('athleteId')
      ? parseInt(searchParams.get('athleteId')!, 10)
      : undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const [overview, list] = await Promise.all([
      getLoadOverview(),
      listLoadRecords({ athleteId, startDate, endDate, page, pageSize }),
    ]);

    return Response.json({ success: true, data: { overview, ...list } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.HEALTH_WRITE);
    const body = await request.json();

    const record = await createLoadRecord(
      {
        athleteId: body.athleteId,
        recordDate: body.recordDate,
        rpe: body.rpe,
        durationMinutes: body.durationMinutes,
        trainingType: body.trainingType,
        notes: body.notes,
      },
      user.userId
    );

    return Response.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
