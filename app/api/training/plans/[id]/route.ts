import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  getTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
} from '@/lib/modules/training/TrainingService';
import { trainingPlanCreateSchema, trainingPlanDraftSchema } from '@/lib/utils/validation';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的训练计划ID');
    }

    const result = await getTrainingPlan(id);
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
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的训练计划ID');
    }

    const body = await request.json();
    // 草稿编辑走宽松校验（允许暂缺运动员/执行时间、允许空练习列表）；正式计划编辑走完整校验
    const schema = body?.status === 'DRAFT' ? trainingPlanDraftSchema : trainingPlanCreateSchema;
    const parsed = schema.partial().safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const result = await updateTrainingPlan(id, parsed.data, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的训练计划ID');
    }

    const result = await deleteTrainingPlan(id, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}