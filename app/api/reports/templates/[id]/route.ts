/**
 * 报告模板详情 API —— /api/reports/templates/[id]
 *
 * GET: 查询单个模板
 * PUT: 更新模板（仅本人 PERSONAL 模板可改）
 * DELETE: 删除模板（仅本人 PERSONAL 模板可删）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { getReportDefinition, isReportType } from '@/lib/modules/reports/reportRegistry';
import {
  getReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
} from '@/lib/modules/reports/ReportTemplateService';
import type { ReportType } from '@/lib/modules/reports/types';

function parseId(id: string): number {
  const n = parseInt(id);
  if (isNaN(n)) throw new ValidationError('无效的模板ID');
  return n;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await getReportTemplate(parseId(params.id));
    const def = getReportDefinition(template.reportType)!;
    await requirePermission(def.requiredPermission);
    return Response.json({ success: true, data: template });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseId(params.id);
    const body = await request.json();
    const reportType = body?.reportType as ReportType;
    if (!reportType || !isReportType(reportType)) {
      throw new ValidationError('无效的报告类型');
    }

    const def = getReportDefinition(reportType)!;
    const user = await requirePermission(def.requiredPermission);

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const keys = Array.isArray(body?.config?.keys) ? body.config.keys : null;
    if (!name) throw new ValidationError('模板名称不能为空');
    if (!keys) throw new ValidationError('指标配置无效');

    const template = await updateReportTemplate(id, user.userId, {
      name,
      reportType,
      config: { keys },
      isDefault: body?.isDefault === true,
    });

    return Response.json({ success: true, data: template });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseId(params.id);
    const template = await getReportTemplate(id);
    const def = getReportDefinition(template.reportType)!;
    const user = await requirePermission(def.requiredPermission);

    await deleteReportTemplate(id, user.userId);
    return Response.json({ success: true, data: { id } });
  } catch (error) {
    return handleRouteError(error);
  }
}
