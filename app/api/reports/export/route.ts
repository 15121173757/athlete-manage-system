/**
 * 报告导出 API —— /api/reports/export
 *
 * POST body: {
 *   reportType: 'training' | 'fitness' | 'injury',
 *   filters?: ReportQuery,
 *   keys?: string[]            // 已选指标 keys，缺省则用默认配置
 * }
 *
 * 返回：application/pdf 二进制流（服务端生成，嵌入中文字体）。
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { getReportDefinition, isReportType, validateReportQuery } from '@/lib/modules/reports/reportRegistry';
import { resolveMetricKeys } from '@/lib/modules/reports/ReportTemplateService';
import { filterReportData } from '@/lib/modules/reports/reportData';
import { generateReportPdf } from '@/lib/modules/reports/ReportPdfExport';
import type { ReportQuery, ReportType } from '@/lib/modules/reports/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reportType = body?.reportType as ReportType;
    if (!reportType || !isReportType(reportType)) {
      throw new ValidationError('无效的报告类型');
    }

    const def = getReportDefinition(reportType)!;
    const user = await requirePermission(def.requiredPermission);

    const filters = (body?.filters ?? {}) as ReportQuery;
    // 统一校验并回填作用域（时间范围必填 / 作用域合法 / 运动员数量符合要求）
    filters.scope = validateReportQuery(filters, def);

    const keys = Array.isArray(body?.keys) && body.keys.length
      ? body.keys.filter((k: unknown): k is string => typeof k === 'string')
      : await resolveMetricKeys(reportType, user.userId);

    const report = await def.aggregate(filters);
    const filtered = filterReportData(report, keys);
    const buffer = generateReportPdf(filtered);

    const filename = `report-${reportType}-${Date.now()}.pdf`;
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
