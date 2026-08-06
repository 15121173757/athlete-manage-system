import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { signToken, verifyPassword, getCookieConfig } from '@/lib/auth/session';
import { ValidationError, handleRouteError } from '@/lib/errors/ErrorPresenter';
import { UserRole } from '@/types';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      throw new ValidationError(firstError?.message || '输入数据无效');
    }

    const { username, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new ValidationError('用户名或密码错误');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new ValidationError('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new ValidationError('账户已被停用，请联系管理员');
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      isActive: user.isActive,
    });

    const cookieStore = await cookies();
    const cookieConfig = getCookieConfig();
    cookieStore.set('ams_session', token, cookieConfig);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role as UserRole,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}