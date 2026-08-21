// ============================================================
// 认证中间件 —— 运动员管理系统（AMS）
// ============================================================
// 职责：
// 1. 从 Cookie 提取并验证 JWT
// 2. 检查用户角色是否拥有所需权限
// 3. 返回会话用户信息供后续业务使用
// ============================================================

import { cookies } from 'next/headers';
import { COOKIE_NAME, verifyToken } from '@/lib/auth/session';
import { hasPermission, UserRole, type PermissionKey, type UserInfo } from '@/types';
import { ForbiddenError, ValidationError } from '@/lib/errors/ErrorPresenter';
import { prisma } from '@/lib/db/prisma';

// ============================================================
// 获取当前会话用户（不检查权限）
// ============================================================

export async function getSessionUser(): Promise<UserInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token);
    // 以数据库为准重新校验用户：JWT 中记录的 userId 可能因账号被删除/停用而失效，
    // 若盲信 JWT，会导致后续写操作触发误导性的外键约束错误（P2003）
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      return null;
    }
    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      isActive: user.isActive,
    };
  } catch {
    return null;
  }
}

// ============================================================
// 权限守卫：要求用户拥有指定权限
// ============================================================

export async function requirePermission(permission: PermissionKey): Promise<UserInfo> {
  const user = await getSessionUser();

  if (!user) {
    throw new ValidationError('未登录或登录已过期，请重新登录');
  }

  if (!user.isActive) {
    throw new ForbiddenError('账户已被停用，请联系管理员');
  }

  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError(`您的角色（${user.role}）无权执行此操作`);
  }

  return user;
}