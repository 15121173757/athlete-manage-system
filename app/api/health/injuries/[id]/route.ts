/**
 * 伤病记录详情 API —— /api/health/injuries/[id]
 *
 * GET: 查询伤病详情（含修改历史）
 * PUT: 更新伤病记录（自动记录变更历史）
 * DELETE: 删除伤病记录
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getInjuryById,
  updateInjury,
  deleteInjury,
} from '@/lib/modules/health/HealthService';
import { injuryUpdateSchema } from '@/lib/utils/validation';
import { ValidationError, NotFoundError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const id = parseInt(params.id);
    if (isNaN(id)) throw new ValidationError('无效的伤病记录ID');

    const injury = await getInjuryById(id);
    if (!injury) throw new NotFoundError('伤病记录不存在');
    return Response.json({ success: true, data: injury });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.HEALTH_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) throw new ValidationError('无效的伤病记录ID');

    const body = await request.json();
    const { note, ...rest } = body;
    const parsed = injuryUpdateSchema.safeParse(rest);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const injury = await updateInjury(id, { ...parsed.data, note: typeof note === 'string' ? note : undefined }, user.userId);
    return Response.json({ success: true, data: injury });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.HEALTH_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) throw new ValidationError('无效的伤病记录ID');

    const result = await deleteInjury(id, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
