/**
 * 报告指标 API —— /api/reports/metrics
 *
 * GET: 返回某报告类型的全部指标定义 + 当前生效指标 keys。
 *
 * 查询参数：
 * - reportType (必填)：training / fitness / injury
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { getReportDefinition, isReportType } from '@/lib/modules/reports/reportRegistry';
import { resolveMetricKeys } from '@/lib/modules/reports/ReportTemplateService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    if (!reportType || !isReportType(reportType)) {
      throw new ValidationError('无效的报告类型');
    }

    const def = getReportDefinition(reportType)!;
    const user = await requirePermission(def.requiredPermission);

    const keys = await resolveMetricKeys(reportType, user.userId);

    return Response.json({
      success: true,
      data: {
        reportType,
        metrics: def.metrics,
        keys,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
