/**
 * 运动员头像上传 API —— /api/athletes/[id]/photo
 *
 * POST: 上传头像照片（multipart/form-data，字段名 file）
 * 校验：仅 JPG/PNG、不超过 5MB、魔数验证
 * 存储：public/uploads/athletes/，并更新数据库 photoUrl
 */

import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getAthlete, updateAthlete } from '@/lib/modules/athlete/AthleteService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

/** 文件大小上限：5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 允许的 MIME 类型与扩展名 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png'];

/** 上传存储目录（项目 public 下，可通过 /uploads/athletes/ 静态访问） */
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'athletes');

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission(Permissions.ATHLETE_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的运动员ID');
    }

    // 确认运动员存在并获取旧照片
    const existing = await getAthlete(id);
    if (!existing) {
      throw new ValidationError('运动员不存在');
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('请选择要上传的照片文件');
    }

    // 大小校验
    if (file.size === 0) {
      throw new ValidationError('文件内容为空');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError('图片大小不能超过 5MB');
    }

    // 类型校验：MIME 与扩展名
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('仅支持 JPG / PNG 格式的图片');
    }
    if (!ALLOWED_EXTS.includes(ext)) {
      throw new ValidationError('仅支持 .jpg / .jpeg / .png 文件');
    }

    // 魔数校验：验证真实文件内容而非仅信任扩展名
    const buffer = Buffer.from(await file.arrayBuffer());
    const isJpeg = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer.length > 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    if (!isJpeg && !isPng) {
      throw new ValidationError('文件内容不是有效的 JPG/PNG 图片');
    }

    // 写入存储目录（文件名含运动员 ID 与时间戳，避免路径注入）
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `athlete-${id}-${Date.now()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const photoUrl = `/uploads/athletes/${filename}`;

    // 更新数据库照片关联
    const updated = await updateAthlete(id, { photoUrl }, user.userId);

    // 清理旧头像文件（保留最新，避免存储堆积；失败不影响主流程）
    const oldUrl = existing.photoUrl;
    if (oldUrl && oldUrl.startsWith('/uploads/athletes/') && oldUrl !== photoUrl) {
      try {
        const oldPath = path.join(process.cwd(), 'public', oldUrl);
        await fs.unlink(oldPath);
      } catch {
        // 旧文件不存在则忽略
      }
    }

    return Response.json({ success: true, data: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
