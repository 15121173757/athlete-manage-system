/**
 * 伤病附件上传 API —— /api/health/injuries/[id]/attachment
 *
 * POST: 上传伤病附件（multipart/form-data，字段名 file）
 * 校验：仅图片（JPG/PNG/WEBP/GIF）与 PDF、不超过 10MB、魔数验证
 * 存储：public/uploads/injuries/，并更新伤病记录附件元信息
 */

import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getInjuryById, setInjuryAttachment } from '@/lib/modules/health/HealthService';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

/** 文件大小上限：10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 允许的 MIME 类型与扩展名（影像资料与诊断报告） */
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];

/** 上传存储目录（项目 public 下，可通过 /uploads/injuries/ 静态访问） */
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'injuries');

/** 校验文件魔数，防止伪装文件 */
function isValidMagic(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime === 'image/webp') {
    return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mime === 'image/gif') {
    return buffer.length > 3 && buffer.toString('ascii', 0, 4) === 'GIF8';
  }
  if (mime === 'application/pdf') {
    return buffer.length > 4 && buffer.toString('ascii', 0, 5) === '%PDF-';
  }
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(Permissions.HEALTH_WRITE);
    const id = parseInt(params.id);
    if (isNaN(id)) {
      throw new ValidationError('无效的伤病记录ID');
    }

    // 确认伤病记录存在并获取旧附件信息
    const existing = await getInjuryById(id);
    if (!existing) {
      throw new ValidationError('伤病记录不存在');
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('请选择要上传的附件文件');
    }

    // 大小校验
    if (file.size === 0) {
      throw new ValidationError('文件内容为空');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError('附件大小不能超过 10MB');
    }

    // 类型校验：MIME 与扩展名
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('仅支持 JPG / PNG / WEBP / GIF 图片或 PDF 文件');
    }
    if (!ALLOWED_EXTS.includes(ext)) {
      throw new ValidationError('不支持的文件扩展名');
    }

    // 魔数校验：验证真实文件内容
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isValidMagic(buffer, file.type)) {
      throw new ValidationError('文件内容与声明格式不符');
    }

    // 写入存储目录（文件名含伤病 ID 与时间戳，避免路径注入）
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `injury-${id}-${Date.now()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const attachmentPath = `/uploads/injuries/${filename}`;

    // 更新数据库附件元信息
    const updated = await setInjuryAttachment(id, {
      path: attachmentPath,
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // 清理旧附件文件（保留最新；失败不影响主流程）
    const oldPath = existing.attachmentPath;
    if (oldPath && oldPath.startsWith('/uploads/injuries/') && oldPath !== attachmentPath) {
      try {
        await fs.unlink(path.join(process.cwd(), 'public', oldPath));
      } catch {
        /* 旧文件不存在则忽略 */
      }
    }

    return Response.json({ success: true, data: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
