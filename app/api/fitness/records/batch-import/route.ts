import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { handleRouteError, ValidationError } from '@/lib/errors/ErrorPresenter';
import { batchCreateFitnessRecords } from '@/lib/modules/fitness/FitnessService';
import { z } from 'zod';

const batchImportSchema = z.array(
  z.object({
    athleteId: z.number().int().positive('运动员ID必须为正整数'),
    testId: z.number().int().positive('测试项目ID必须为正整数'),
    value: z.number({ required_error: '数值为必填项', invalid_type_error: '数值必须为数字' }),
    testDate: z.string().min(1, '测试日期不能为空'),
    notes: z.string().optional().nullable(),
  })
);

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(Permissions.FITNESS_WRITE);

    const body = await request.json();
    const records = body.records || body;
    const parsed = batchImportSchema.safeParse(records);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new ValidationError(`数据格式不正确: ${issues}`);
    }

    const result = await batchCreateFitnessRecords(parsed.data, user.userId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `导入完成：成功 ${result.successCount} 条，失败 ${result.failCount} 条`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
