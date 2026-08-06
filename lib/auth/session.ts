// ============================================================
// 会话管理 —— 运动员管理系统（AMS）
// ============================================================
// 职责：
// 1. JWT 签发与验证（基于 jose）
// 2. 密码哈希与校验（基于 bcryptjs）
// 3. Cookie 配置
// ============================================================

import { SignJWT, jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@/types';

// ============================================================
// 常量
// ============================================================

export const COOKIE_NAME = 'ams_session';
export const TOKEN_EXPIRES_HOURS = 24;

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ams-dev-secret-change-in-production'
);

// ============================================================
// 类型定义
// ============================================================

export interface SessionPayload {
  userId: number;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

// ============================================================
// JWT 操作
// ============================================================

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRES_HOURS}h`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as SessionPayload;
}

// ============================================================
// 密码操作
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// Cookie 配置
// ============================================================

export function getCookieConfig(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRES_HOURS * 60 * 60,
    path: '/',
  };
}