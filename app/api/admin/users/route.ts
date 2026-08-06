/**
 * 用户管理 API —— /api/admin/users
 *
 * GET: 用户列表（仅管理员）
 * POST: 创建用户（仅管理员）
 * PUT: 更新用户（仅管理员）
 */

import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/session';
import { logAction } from '@/lib/modules/audit/AuditService';
import { BusinessError, handleRouteError, ValidationError } from '@/lib/errors/ErrorPresenter';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.USER_MANAGE);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || undefined;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { username: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return Response.json({ success: true, data: { users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission(Permissions.USER_MANAGE);
    const body = await request.json();
    const { username, password, name, role } = body;

    if (!username || !password || !name) {
      throw new ValidationError('用户名、密码、姓名不能为空');
    }
    if (!['COACH', 'MEDICAL', 'ADMIN'].includes(role)) {
      throw new ValidationError('角色无效（应为 COACH/MEDICAL/ADMIN）');
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new BusinessError('DUPLICATE', `用户名「${username}」已存在`);

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: { username, passwordHash, name, role },
      select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true },
    });

    await logAction({
      userId: user.userId,
      action: 'CREATE_USER',
      targetType: 'User',
      targetId: newUser.id,
      detail: { username, name, role },
    });

    return Response.json({ success: true, data: newUser }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission(Permissions.USER_MANAGE);
    const body = await request.json();
    const { id, name, role, isActive, password } = body;

    if (!id) throw new ValidationError('用户 ID 不能为空');

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new BusinessError('NOT_FOUND', '用户不存在');

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (role && ['COACH', 'MEDICAL', 'ADMIN'].includes(role)) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (password) updateData.passwordHash = await hashPassword(password);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, name: true, role: true, isActive: true },
    });

    await logAction({
      userId: user.userId,
      action: 'UPDATE_USER',
      targetType: 'User',
      targetId: id,
      detail: { name, role, isActive },
    });

    return Response.json({ success: true, data: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
