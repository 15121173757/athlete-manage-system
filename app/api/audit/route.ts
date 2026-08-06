/**
 * 审计日志 API —— /api/audit
 *
 * GET: 分页查询审计日志（仅管理员）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { queryAuditLogs } from '@/lib/modules/audit/AuditService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.AUDIT_READ);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined;
    const action = searchParams.get('action') || undefined;
    const targetType = searchParams.get('targetType') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await queryAuditLogs({ userId, action, targetType, startDate, endDate, page, pageSize });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
