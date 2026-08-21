import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getAthleteAnalysisData } from '@/lib/modules/fitness/FitnessService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const { searchParams } = new URL(request.url);
    const athleteId = parseInt(searchParams.get('athleteId') || '', 10);
    const category = searchParams.get('category')?.trim() || undefined;

    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      throw new ValidationError('运动员参数无效');
    }

    const data = await getAthleteAnalysisData(athleteId, category);
    return Response.json({ success: true, data });
  } catch (error) {
    return handleRouteError(error);
  }
}
