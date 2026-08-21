/**
 * 修改密码 API —— /api/auth/password
 *
 * PUT: 当前登录用户修改自己的密码
 * 说明：任何已登录用户均可调用（无需特定权限），需校验原密码。
 */

import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/AuthMiddleware';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword, hashPassword } from '@/lib/auth/session';
import { logAction } from '@/lib/modules/audit/AuditService';
import { BusinessError, ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ValidationError('未登录或登录已过期，请重新登录');

    const body = await request.json();
    const { oldPassword, newPassword } = body ?? {};

    if (!oldPassword || !newPassword) throw new ValidationError('请输入原密码和新密码');
    if (newPassword.length < 6) throw new ValidationError('新密码长度不能少于 6 位');
    if (oldPassword === newPassword) throw new ValidationError('新密码不能与原密码相同');

    const record = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!record) throw new ValidationError('用户不存在');

    const valid = await verifyPassword(oldPassword, record.passwordHash);
    if (!valid) throw new BusinessError('WRONG_PASSWORD', '原密码不正确', 400);

    await prisma.user.update({
      where: { id: user.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await logAction({
      userId: user.userId,
      action: 'UPDATE_PASSWORD',
      targetType: 'User',
      targetId: user.userId,
    });

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
