/**
 * 报告查询 API —— /api/reports/query
 *
 * GET: 根据报告类型与筛选条件聚合报告数据。
 *
 * 查询参数：
 * - reportType (必填)：training / fitness / injury
 * - scope (可选)：PERSONAL（个人）/ TEAM（团队），缺省团队
 * - athleteIds (可选，逗号分隔)：个人 1 名，团队 2 名及以上
 * - exerciseId / testId (可选)：筛选维度
 * - status (可选，伤病报告)：INJURED / RECOVERING / RETURNED
 * - startDate / endDate (必填)：YYYY-MM-DD 日期范围
 *
 * 返回：统一 ReportData 聚合结果 + 当前生效指标 keys。
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { getReportDefinition, isReportType, validateReportQuery } from '@/lib/modules/reports/reportRegistry';
import { resolveMetricKeys } from '@/lib/modules/reports/ReportTemplateService';
import type { ReportQuery, ReportScope } from '@/lib/modules/reports/types';

function parseIntParam(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = parseInt(value);
  return isNaN(n) ? undefined : n;
}

/** 解析逗号分隔的运动员 ID 列表（个人报告 1 个，团队报告 2 个及以上） */
function parseIntListParam(value: string | null): number[] | undefined {
  if (value == null || value === '') return undefined;
  const ids = value
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));
  return ids.length ? ids : undefined;
}

function validateDate(value: string | undefined, label: string): void {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${label}格式无效`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    if (!reportType || !isReportType(reportType)) {
      throw new ValidationError('无效的报告类型');
    }

    const def = getReportDefinition(reportType)!;
    const user = await requirePermission(def.requiredPermission);

    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    validateDate(startDate, '起始日期');
    validateDate(endDate, '结束日期');

    const scopeParam = searchParams.get('scope');
    const query: ReportQuery = {
      scope: (scopeParam === 'PERSONAL' || scopeParam === 'TEAM' ? scopeParam : undefined) as ReportScope | undefined,
      athleteIds: parseIntListParam(searchParams.get('athleteIds')),
      exerciseId: parseIntParam(searchParams.get('exerciseId')),
      testId: parseIntParam(searchParams.get('testId')),
      status: searchParams.get('status') || undefined,
      startDate,
      endDate,
    };

    // 统一校验：时间范围必填、作用域合法、运动员数量符合作用域要求
    query.scope = validateReportQuery(query, def);

    const [report, keys] = await Promise.all([
      def.aggregate(query),
      resolveMetricKeys(reportType, user.userId),
    ]);

    return Response.json({
      success: true,
      data: { report, keys },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
