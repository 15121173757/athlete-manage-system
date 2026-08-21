/**
 * 训练计划导出 API —— /api/training/plans/[id]/export
 *
 * GET: 导出指定运动员在本计划中的全部练习安排
 * ?athleteId=123 (必填) &date=2026-08-05 (必填，用于文件命名/兜底标题) &format=pdf|excel (默认 pdf)
 * 实际导出的日期以计划执行开始日期（startDate）为准。
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { exportTrainingPlanForAthlete } from '@/lib/modules/io/ExportService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.TRAINING_READ);

    const planId = parseInt(params.id);
    if (isNaN(planId)) {
      throw new ValidationError('无效的训练计划ID');
    }

    const { searchParams } = new URL(request.url);
    const athleteIdParam = searchParams.get('athleteId');
    const date = searchParams.get('date');
    const format = (searchParams.get('format') || 'pdf').toLowerCase();

    if (!athleteIdParam) {
      throw new ValidationError('请指定运动员ID（athleteId 参数）');
    }
    if (!date) {
      throw new ValidationError('请指定导出日期（date 参数，格式 YYYY-MM-DD）');
    }
    if (format !== 'pdf' && format !== 'excel') {
      throw new ValidationError('导出格式无效，仅支持 pdf 或 excel');
    }

    const athleteId = parseInt(athleteIdParam);
    if (isNaN(athleteId)) {
      throw new ValidationError('无效的运动员ID');
    }

    const buffer = await exportTrainingPlanForAthlete(planId, athleteId, date, format);

    // 注意：Content-Disposition header 不允许非 ASCII 字符，
    // 必须使用 RFC 5987 的 filename* 参数承载中文文件名，否则 Response 构造会崩溃
    const athleteName = searchParams.get('athleteName') || `athlete-${athleteId}`;
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    const safeName = athleteName.replace(/[^\w\u4e00-\u9fa5-]/g, '');
    const asciiFallback = `training-plan-${athleteId}-${date}.${ext}`;
    const encodedName = encodeURIComponent(safeName || `athlete-${athleteId}`);

    const contentType =
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition':
          `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}-${date}.${ext}`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
