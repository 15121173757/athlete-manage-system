/**
 * 出勤报告导出 API —— /api/attendance/report/export
 *
 * POST body: {
 *   dimension: 'individual' | 'team',
 *   athleteId?: number,          // individual 必填
 *   startDate: 'YYYY-MM-DD',
 *   endDate: 'YYYY-MM-DD',
 *   format: 'pdf' | 'word'
 * }
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  buildIndividualAttendanceReport,
  buildTeamAttendanceReport,
} from '@/lib/modules/attendance/AttendanceService';
import {
  exportAttendanceReportPDF,
  exportAttendanceReportWord,
} from '@/lib/modules/attendance/AttendanceReportExport';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const body = await request.json();
    const { dimension, athleteId, startDate, endDate, format, sport } = body as {
      dimension?: string;
      athleteId?: number;
      startDate?: string;
      endDate?: string;
      format?: string;
      sport?: string;
    };

    if (!startDate || !endDate) throw new ValidationError('请指定报告时间范围');

    const report =
      dimension === 'individual'
        ? await buildIndividualAttendanceReport(
            athleteId ?? 0,
            startDate,
            endDate
          )
        : await buildTeamAttendanceReport(startDate, endDate, sport);

    if (format === 'word') {
      const buffer = await exportAttendanceReportWord(report);
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="attendance-report-${Date.now()}.docx"`,
        },
      });
    }

    const buffer = await exportAttendanceReportPDF(report);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="attendance-report-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
