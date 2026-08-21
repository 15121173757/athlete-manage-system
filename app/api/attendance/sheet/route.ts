/**
 * 出勤表 API —— /api/attendance/sheet
 *
 * GET    ?date=YYYY-MM-DD   查询某日出勤表（计划名单自动生成 + 已有记录 + 可手动添加人员）
 * PUT    新增/更新某运动员的出勤状态
 * DELETE ?date=...&athleteId=...  删除出勤记录（重置为未标记）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listAttendanceSheet,
  upsertAttendanceRecord,
  deleteAttendanceRecord,
} from '@/lib/modules/attendance/AttendanceService';
import { attendanceUpsertSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const result = await listAttendanceSheet(date);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const body = await request.json();
    const parsed = attendanceUpsertSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const record = await upsertAttendanceRecord(parsed.data, user.userId);
    return Response.json({ success: true, data: record });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const athleteIdRaw = searchParams.get('athleteId');

    if (!date || !athleteIdRaw) {
      throw new ValidationError('缺少日期或运动员ID');
    }
    const athleteId = parseInt(athleteIdRaw);
    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      throw new ValidationError('运动员ID必须为正整数');
    }

    await deleteAttendanceRecord(date, athleteId, user.userId);
    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
