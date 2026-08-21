/**
 * 出勤报告可选运动项目 API —— /api/attendance/sports
 *
 * GET  返回当前在册运动员所属的运动项目种类（去重），用于团队出勤报告的项目筛选
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { listAthleteSports } from '@/lib/modules/attendance/AttendanceService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET() {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const sports = await listAthleteSports();
    return Response.json({ success: true, data: { sports } });
  } catch (error) {
    return handleRouteError(error);
  }
}
