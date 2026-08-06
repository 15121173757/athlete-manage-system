/**
 * 审计日志服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 记录关键业务操作日志
 * 2. 分页查询审计日志
 */

import { prisma } from '@/lib/db/prisma';

// ============================================================
// 类型定义
// ============================================================

export interface LogActionInput {
  userId: number;
  action: string;
  targetType: string;
  targetId?: number | string | null;
  detail?: Record<string, unknown>;
}

export interface QueryAuditLogsParams {
  userId?: number;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================
// 操作日志
// ============================================================

export async function logAction(input: LogActionInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId != null ? String(input.targetId) : null,
      detail: JSON.stringify(input.detail ?? {}) as any,
    },
  });
}

// ============================================================
// 查询日志
// ============================================================

export async function queryAuditLogs(params: QueryAuditLogsParams) {
  const { userId, action, targetType, startDate, endDate, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.createdAt = dateFilter;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, username: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}