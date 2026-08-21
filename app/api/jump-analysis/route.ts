/**
 * 跳跃分析 API —— /api/jump-analysis
 *
 * GET     ?athleteId=&startDate=&endDate=&testType=&limit=  查询跳跃分析历史记录
 * POST    新增一条跳跃分析记录（单跳 / 10-5 重复跳）
 * DELETE  ?id=  删除一条记录
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  createJumpAnalysis,
  deleteJumpAnalysis,
  listJumpAnalysis,
} from '@/lib/modules/jump/JumpAnalysisService';
import { jumpAnalysisCreateSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);

    const athleteIdRaw = searchParams.get('athleteId');
    const limitRaw = searchParams.get('limit');
    const athleteId = athleteIdRaw ? parseInt(athleteIdRaw) : undefined;
    const limit = limitRaw ? parseInt(limitRaw) : undefined;

    if (athleteIdRaw && (!Number.isInteger(athleteId) || athleteId! <= 0)) {
      throw new ValidationError('运动员ID必须为正整数');
    }
    if (limitRaw && (!Number.isInteger(limit) || limit! <= 0)) {
      throw new ValidationError('limit 必须为正整数');
    }

    const result = await listJumpAnalysis({
      athleteId,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      testType: searchParams.get('testType') ?? undefined,
      limit,
    });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const body = await request.json();
    const parsed = jumpAnalysisCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const record = await createJumpAnalysis(parsed.data, user.userId);
    return Response.json({ success: true, data: record });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const { searchParams } = new URL(request.url);
    const idRaw = searchParams.get('id');
    if (!idRaw) throw new ValidationError('缺少记录 ID');

    const id = parseInt(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('记录 ID 必须为正整数');
    }

    await deleteJumpAnalysis(id, user.userId);
    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
