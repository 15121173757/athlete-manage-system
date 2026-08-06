/**
 * 收藏切换 API —— /api/exercises/[id]/favorite
 *
 * PATCH: 切换收藏状态
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { toggleFavorite } from '@/lib/modules/exercise/ExerciseService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.TRAINING_WRITE);
    const exercise = await toggleFavorite(parseInt(params.id));
    return Response.json({ success: true, data: exercise });
  } catch (error) {
    return handleRouteError(error);
  }
}
