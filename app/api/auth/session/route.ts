import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/AuthMiddleware';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或登录已过期' } },
        { status: 401 }
      );
    }

    return Response.json({
      success: true,
      data: {
        user: {
          id: user.userId,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}