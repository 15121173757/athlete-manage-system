/**
 * 出勤报告 API —— /api/attendance/report
 *
 * GET ?dimension=individual|team&athleteId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  buildIndividualAttendanceReport,
  buildTeamAttendanceReport,
} from '@/lib/modules/attendance/AttendanceService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);
    const dimension = searchParams.get('dimension') || 'team';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sport = searchParams.get('sport') || undefined;

    if (!startDate || !endDate) {
      throw new ValidationError('请指定报告时间范围');
    }

    if (dimension === 'individual') {
      const athleteIdRaw = searchParams.get('athleteId');
      if (!athleteIdRaw) throw new ValidationError('个人报告需指定运动员');
      const athleteId = parseInt(athleteIdRaw);
      if (!Number.isInteger(athleteId) || athleteId <= 0) {
        throw new ValidationError('运动员ID必须为正整数');
      }
      const result = await buildIndividualAttendanceReport(athleteId, startDate, endDate);
      return Response.json({ success: true, data: result });
    }

    const result = await buildTeamAttendanceReport(startDate, endDate, sport);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
