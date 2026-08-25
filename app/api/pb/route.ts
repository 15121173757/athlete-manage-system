import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import {
  listPersonalBests,
  createManualPB,
} from '@/lib/modules/pb/PBService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';

/**
 * PB 纪录 API —— /api/pb
 *
 * GET:  查询 PB 列表（支持按运动员/项目/分类过滤、分页）
 * POST: 手动录入新的 PB 成绩
 */

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.TRAINING_READ);
    const { searchParams } = new URL(request.url);

    const athleteIdParam = searchParams.get('athleteId');
    const exerciseIdParam = searchParams.get('exerciseId');
    const category = searchParams.get('category') || undefined;
    const team = searchParams.get('team') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    if (isNaN(page) || page < 1) throw new ValidationError('无效的页码');
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ValidationError('无效的每页数量（1-100）');
    }

    const athleteId = athleteIdParam ? parseInt(athleteIdParam) : undefined;
    const exerciseId = exerciseIdParam ? parseInt(exerciseIdParam) : undefined;

    if (athleteIdParam && (athleteId === undefined || isNaN(athleteId))) {
      throw new ValidationError('无效的运动员ID');
    }
    if (exerciseIdParam && (exerciseId === undefined || isNaN(exerciseId))) {
      throw new ValidationError('无效的项目ID');
    }

    // 多条件排序：sort=字段:方向，重复参数表示排序优先级（先出现的为主排序）
    const sortFields = ['athlete', 'exercise', 'category', 'value'] as const;
    const sortDirections = ['asc', 'desc'] as const;
    const sorts = searchParams
      .getAll('sort')
      .map((s) => {
        const [field, direction] = s.split(':');
        return { field, direction };
      })
      .filter(
        (s): s is { field: (typeof sortFields)[number]; direction: (typeof sortDirections)[number] } =>
          (sortFields as readonly string[]).includes(s.field) &&
          (sortDirections as readonly string[]).includes(s.direction)
      );

    const result = await listPersonalBests({ athleteId, exerciseId, category, team, page, pageSize, sorts });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(Permissions.TRAINING_WRITE);
    const body = await request.json();

    const athleteId = parseInt(body.athleteId);
    const exerciseId = parseInt(body.exerciseId);
    const value = parseFloat(body.value);
    const achievedDate = body.achievedDate ? new Date(body.achievedDate) : new Date();

    if (isNaN(athleteId)) throw new ValidationError('请选择运动员');
    if (isNaN(exerciseId)) throw new ValidationError('请选择训练项目');
    if (isNaN(value) || value <= 0) throw new ValidationError('PB 成绩必须为大于 0 的数字');
    if (isNaN(achievedDate.getTime())) throw new ValidationError('日期格式无效');

    const result = await createManualPB({ athleteId, exerciseId, value, achievedDate });

    await logAction({
      userId: user.userId,
      action: result.updated ? 'UPDATE_PB' : 'CREATE_PB',
      targetType: 'PersonalBest',
      targetId: String(result.record.id),
      detail: { ...result.record, athleteId, exerciseId },
    });

    return Response.json({ success: true, data: result }, { status: result.updated ? 200 : 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
