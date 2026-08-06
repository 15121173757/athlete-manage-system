/**
 * 运动员批量导入 API —— /api/athletes/import
 *
 * POST: 上传 Excel/CSV 文件，批量导入运动员
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { parseFile, importAthletes } from '@/lib/modules/io/ImportService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(Permissions.ATHLETE_WRITE);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '请上传文件' } },
        { status: 400 }
      );
    }

    // 检查文件类型
    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.csv')) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '仅支持 .xlsx、.xls、.csv 格式' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseFile(buffer, filename);

    if (parsed.length === 0) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '文件中没有有效数据' } },
        { status: 400 }
      );
    }

    const result = await importAthletes(parsed, user.userId);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
