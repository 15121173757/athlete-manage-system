/**
 * 体能测试计划发布 API —— /api/fitness/plans/[id]/publish
 *
 * POST: 发布草稿状态的体能测试计划。
 * 校验计划完整性（名称/测试日期/至少一个测试项目/至少一名参与运动员）后，
 * 依据执行时间与当前北京时间的关系自动判定为「待执行（SCHEDULED）」或「已执行（COMPLETED）」。
 *
 * 【状态流转规则】（统一北京时间 UTC+8，精确到分钟）
 * - 草稿（DRAFT）→ 发布 → 执行时间晚于当前时间 → 待执行（SCHEDULED）
 * - 草稿（DRAFT）→ 发布 → 执行时间早于或等于当前时间 → 已执行（COMPLETED）
 * - 发布成功后状态不再回退为草稿；状态由定时任务与列表/详情实时检查继续自动刷新
 * - 发布操作写入审计日志 PUBLISH_FITNESS_PLAN（记录前后值、操作人、操作时间）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { publishFitnessPlan } from '@/lib/modules/fitness/FitnessService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.FITNESS_WRITE);
    const id = parseInt(params.id);
    const result = await publishFitnessPlan(id, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
