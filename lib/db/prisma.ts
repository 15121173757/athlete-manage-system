/**
 * Prisma 客户端单例
 *
 * 设计说明：
 * Next.js 开发环境下 hot reload 会导致 globalThis 上重复实例化 PrismaClient，
 * 进而耗尽数据库连接。这里采用「单例模式」确保全局只保留一个实例。
 *
 * 扩展点：
 * 生产环境可在此处接入日志中间件（如打印慢查询），但 V1 不引入。
 */

import { PrismaClient } from '@prisma/client';

// 声明 globalThis 上的 prisma 字段，避免 TS 报错
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
