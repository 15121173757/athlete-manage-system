import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}