/**
 * 体能测试计划 API —— /api/fitness/plans/[id]
 *
 * GET: 获取单个体能测试计划（读取前自动刷新单条状态）
 * PUT: 更新体能测试计划
 * DELETE: 删除体能测试计划
 *
 * 【状态流转规则】（统一北京时间 UTC+8，精确到分钟）
 * - 草稿（DRAFT）：body.status 显式传 'DRAFT' → 保持草稿；草稿未显式转正时保持草稿
 * - 其他情况（未传 status 或传 SCHEDULED/COMPLETED）：按更新后的执行时间
 *   （testDate + startTime，+08:00 解析）与当前北京时间关系自动判定为待执行或已执行
 * - 状态变更写入审计日志 FITNESS_PLAN_STATUS_CHANGE（记录前后值、操作人、触发来源 EDIT）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getFitnessPlan,
  updateFitnessPlan,
  deleteFitnessPlan,
} from '@/lib/modules/fitness/FitnessService';
import { fitnessPlanCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_READ);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const result = await getFitnessPlan(id);
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
    const user = await requirePermission(Permissions.FITNESS_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const body = await request.json();
    const parsed = fitnessPlanCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await updateFitnessPlan(id, parsed.data, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.FITNESS_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的测试计划ID');
    }

    const result = await deleteFitnessPlan(id);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
