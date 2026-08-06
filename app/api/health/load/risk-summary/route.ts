/**
 * 风险预警摘要 API —— /api/health/load/risk-summary
 *
 * GET: 全队 ACWR 风险预警摘要（数据看板使用）
 * - 严格依据 ACWR 数值分级（<0.8 绿 / 0.8-1.3 黄 / 1.3-1.5 橙 / >1.5 红）
 * - 按风险优先级排序，默认返回 Top 5
 * - 返回前对每个 ACWR 数值执行有效性校验，非法值降级为 NO_DATA
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getAcwrRiskSummary,
  validateAcwrValue,
} from '@/lib/modules/health/LoadService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';
import type { AcwrRiskLevel } from '@/lib/modules/health/loadConstants';

export async function GET() {
  try {
    await requirePermission(Permissions.HEALTH_READ);

    const summary = await getAcwrRiskSummary(5);

    // 数据验证机制：确保返回的 ACWR 数值有效；无效数值置 null 并降级为 NO_DATA
    const items = summary.map((item) => {
      if (!validateAcwrValue(item.acwr)) {
        return { ...item, acwr: null, riskLevel: 'NO_DATA' as AcwrRiskLevel };
      }
      return item;
    });

    return Response.json({
      success: true,
      data: {
        items,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
