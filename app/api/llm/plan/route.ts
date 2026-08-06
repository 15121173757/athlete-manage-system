import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { generateTrainingPlan } from '@/lib/modules/llm/LLMService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.LLM_USE);

    const body = await request.json();
    const athleteId = Number(body.athleteId);
    const goal = body.goal?.trim();

    if (!athleteId || athleteId <= 0) {
      throw new ValidationError('运动员 ID 无效');
    }
    if (!goal) {
      throw new ValidationError('训练目标不能为空');
    }

    const plan = await generateTrainingPlan(athleteId, goal);

    return Response.json({
      success: true,
      data: {
        plan,
        athlete: { id: athleteId },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}