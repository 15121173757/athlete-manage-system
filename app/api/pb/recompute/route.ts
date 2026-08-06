import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { recomputeAllPBs } from '@/lib/modules/pb/PBService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';

/**
 * PB 重算 API —— /api/pb/recompute
 *
 * POST: 基于历史训练记录重算所有 PB（用于修复公式变更后的历史数据）
 */

export async function POST() {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const result = await recomputeAllPBs();

    await logAction({
      userId: user.userId,
      action: 'RECOMPUTE_PB',
      targetType: 'PersonalBest',
      targetId: 'all',
      detail: result,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
