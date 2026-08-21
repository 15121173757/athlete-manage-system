/**
 * 训练负荷批量导入 API —— /api/health/load/batch
 *
 * POST body: { rows: [{ athleteId, date, rpe, durationMinutes }] }
 *   批量导入历史 RPE 与训练时长数据（逐条校验，部分成功时返回错误明细）
 *   导入成功的数据同步至出勤表对应运动员当天的记录
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { batchImportLoadRecords } from '@/lib/modules/health/LoadService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.HEALTH_WRITE);
    const body = await request.json();

    if (!Array.isArray(body?.rows) || body.rows.length === 0) {
      throw new ValidationError('rows 必须为非空数组');
    }
    if (body.rows.length > 500) {
      throw new ValidationError('单次最多导入 500 条记录');
    }

    const result = await batchImportLoadRecords(body.rows, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
