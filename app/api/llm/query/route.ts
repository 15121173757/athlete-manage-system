/**
 * 自然语言查询助手 API —— /api/llm/query
 *
 * POST: 处理自然语言查询
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { handleQuery } from '@/lib/modules/llm/QueryAssistantService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.LLM_USE);
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '请输入问题' } },
        { status: 400 }
      );
    }

    const result = await handleQuery(question.trim());
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
