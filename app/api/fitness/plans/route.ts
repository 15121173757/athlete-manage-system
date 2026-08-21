/**
 * 体能测试计划 API —— /api/fitness/plans
 *
 * GET: 分页查询体能测试计划（查询前自动刷新非草稿计划的状态）
 * POST: 创建体能测试计划
 *
 * 【状态流转规则】（统一北京时间 UTC+8，精确到分钟）
 * - 草稿（DRAFT）：body.status 显式传 'DRAFT' 时创建为草稿；不参与自动判定，
 *   不计入正常执行序列，仅在发布后进入执行序列
 * - 待执行（SCHEDULED）：执行时间晚于当前北京时间
 * - 已执行（COMPLETED）：执行时间早于或等于当前北京时间
 * - 正式创建（不传 status）时，后端按「执行时间（testDate + startTime，+08:00 解析）」
 *   与「当前北京时间」的关系自动判定为待执行或已执行
 * - 状态由系统定时任务（每小时）与列表/详情实时检查共同刷新
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listFitnessPlans,
  createFitnessPlan,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessPlanCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await listFitnessPlans({ status, page, pageSize });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.FITNESS_WRITE);
    const body = await request.json();
    const parsed = fitnessPlanCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await createFitnessPlan(parsed.data, user.userId);
    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
