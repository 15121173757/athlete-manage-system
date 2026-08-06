/**
 * 训练计划分配 API —— /api/training/plans/[id]/athletes
 *
 * POST: 将训练计划分配给指定运动员（精准分配，覆盖原有分配）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { assignAthletesToPlan } from '@/lib/modules/training/TrainingService';
import { z } from 'zod';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

const assignSchema = z.object({
  athleteIds: z
    .array(z.number().int().positive('运动员ID必须为正整数'))
    .min(1, '请至少选择一名运动员'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);

    const planId = parseInt(params.id);
    if (isNaN(planId)) {
      throw new ValidationError('无效的训练计划ID');
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await assignAthletesToPlan(planId, parsed.data.athleteIds, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
