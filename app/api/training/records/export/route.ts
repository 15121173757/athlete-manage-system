/**
 * 训练记录导出 API —— /api/training/records/export
 *
 * GET: 导出训练记录为 Excel
 * ?athleteId=123 (可选，按运动员筛选)
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { exportTrainingRecordsToExcel } from '@/lib/modules/io/ExportService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId')
      ? parseInt(searchParams.get('athleteId')!)
      : undefined;

    const buffer = await exportTrainingRecordsToExcel(athleteId);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="training-records.xlsx"',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
