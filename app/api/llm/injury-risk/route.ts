/**
 * 伤病风险预警 API —— /api/llm/injury-risk
 *
 * GET: 全队风险概览（默认）/ 单运动员历史趋势（?athleteId=xxx）
 * POST: 单运动员深度风险分析
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  analyzeInjuryRisk,
  listTeamRiskSummary,
  getRiskHistory,
} from '@/lib/modules/llm/InjuryRiskService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (athleteId) {
      // 返回单运动员风险历史趋势
      const history = await getRiskHistory(parseInt(athleteId));
      return Response.json({ success: true, data: history });
    }

    // 默认返回全队风险概览
    const summary = await listTeamRiskSummary();
    return Response.json({ success: true, data: summary });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.LLM_USE);
    const body = await request.json();
    const { athleteId, weeksRange } = body;

    if (!athleteId || typeof athleteId !== 'number') {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 athleteId 参数' } },
        { status: 400 }
      );
    }

    const result = await analyzeInjuryRisk(athleteId, { weeksRange });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
