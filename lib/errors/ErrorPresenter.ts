/**
 * 错误呈现层 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 定义业务异常类（BusinessError）
 * 2. 定义校验异常类（ValidationError）
 * 3. 定义通用异常类（NotFoundError、ForbiddenError）
 * 4. 提供统一的路由错误处理函数
 */

import { NextResponse } from 'next/server';

export class BusinessError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends BusinessError {
  constructor(message = '资源不存在') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends BusinessError {
  constructor(message = '输入数据无效') {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends BusinessError {
  constructor(message = '权限不足') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof BusinessError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  if (error instanceof Error) {
    // Prisma 已知错误兜底（防御层）：任何删除/更新操作触发外键约束或记录缺失时给出友好提示
    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === 'P2003') {
      // 外键约束失败：可能是删除被引用数据，也可能是创建/更新时引用了不存在的数据
      return NextResponse.json(
        { success: false, error: { code: 'FOREIGN_KEY_CONSTRAINT', message: '数据关联异常：操作引用了不存在或已被删除的记录，请刷新页面后重试' } },
        { status: 400 }
      );
    }
    if (prismaCode === 'P2025') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '记录不存在或已被删除' } },
        { status: 404 }
      );
    }
    console.error('[Unhandled Error]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器内部错误，请稍后重试' } },
      { status: 500 }
    );
  }
  console.error('[Unknown Error]', error);
  return NextResponse.json(
    { success: false, error: { code: 'UNKNOWN_ERROR', message: '未知错误' } },
    { status: 500 }
  );
}