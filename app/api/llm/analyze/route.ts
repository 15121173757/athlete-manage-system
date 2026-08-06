import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { analyzeTraining } from '@/lib/modules/llm/LLMService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.LLM_USE);

    const body = await request.json();
    const athleteId = Number(body.athleteId);
    if (!athleteId || athleteId <= 0) {
      throw new ValidationError('运动员 ID 无效');
    }

    const weeksRange = body.options?.weeksRange ?? 4;
    const includePB = body.options?.includePB ?? true;
    const includeInjuries = body.options?.includeInjuries ?? true;

    const endDate = new Date();
    const startDate = new Date(Date.now() - weeksRange * 7 * 24 * 60 * 60 * 1000);

    const analysis = await analyzeTraining(athleteId, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    return Response.json({
      success: true,
      data: {
        analysis,
        athlete: { id: athleteId },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}