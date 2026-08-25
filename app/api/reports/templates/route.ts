/**
 * 报告模板集合 API —— /api/reports/templates
 *
 * GET: 列出某报告类型下本人个人模板 + 全局模板
 * POST: 新建报告模板（PERSONAL 归属当前用户；GLOBAL 需管理员权限）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { getReportDefinition, isReportType } from '@/lib/modules/reports/reportRegistry';
import {
  listReportTemplates,
  createReportTemplate,
} from '@/lib/modules/reports/ReportTemplateService';
import type { ReportType } from '@/lib/modules/reports/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    if (!reportType || !isReportType(reportType)) {
      throw new ValidationError('无效的报告类型');
    }

    const def = getReportDefinition(reportType)!;
    const user = await requirePermission(def.requiredPermission);

    const templates = await listReportTemplates(reportType, user.userId);
    return Response.json({ success: true, data: templates });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reportType = body?.reportType as ReportType;
    if (!reportType || !isReportType(reportType)) {
      throw new ValidationError('无效的报告类型');
    }

    const def = getReportDefinition(reportType)!;
    const user = await requirePermission(def.requiredPermission);

    const scope = body?.scope === 'GLOBAL' ? 'GLOBAL' : 'PERSONAL';
    if (scope === 'GLOBAL') {
      await requirePermission(Permissions.USER_MANAGE);
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const keys = Array.isArray(body?.config?.keys) ? body.config.keys : null;
    if (!name) throw new ValidationError('模板名称不能为空');
    if (!keys) throw new ValidationError('指标配置无效');

    const template = await createReportTemplate(user.userId, {
      name,
      reportType,
      scope,
      config: { keys },
      isDefault: body?.isDefault === true,
    });

    return Response.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
