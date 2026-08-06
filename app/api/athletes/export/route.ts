/**
 * 运动员列表导出 API —— /api/athletes/export
 *
 * GET: 导出运动员列表为 Excel，或导出单个运动员 PDF 报告
 * ?format=excel | pdf
 * ?athleteId=123 (仅 PDF 模式)
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { exportAthletesToExcel, exportAthleteProfilePDF } from '@/lib/modules/io/ExportService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.ATHLETE_READ);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
    const athleteId = searchParams.get('athleteId');

    if (format === 'pdf') {
      if (!athleteId) {
        return Response.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'PDF 导出需指定 athleteId' } },
          { status: 400 }
        );
      }
      const buffer = await exportAthleteProfilePDF(parseInt(athleteId));
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="athlete-profile-${athleteId}.pdf"`,
        },
      });
    }

    // 默认导出 Excel
    const buffer = await exportAthletesToExcel();
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="athletes.xlsx"',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
