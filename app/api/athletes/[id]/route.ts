import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getAthlete, updateAthlete, deleteAthlete } from '@/lib/modules/athlete/AthleteService';
import { athleteUpdateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.ATHLETE_READ);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的运动员ID');
    }

    const result = await getAthlete(id);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.ATHLETE_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的运动员ID');
    }

    const body = await request.json();
    const parsed = athleteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await updateAthlete(id, parsed.data, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.ATHLETE_DELETE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的运动员ID');
    }

    const result = await deleteAthlete(id, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}