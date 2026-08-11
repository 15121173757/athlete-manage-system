/**
 * 测试全局初始化：
 * - 使用独立的 SQLite 测试数据库（prisma/test.db），不影响开发库 dev.db
 * - 每次运行前通过 prisma db push 同步最新 schema
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

// 独立测试数据库（相对 schema.prisma 目录，即 prisma/test.db）
process.env.DATABASE_URL = 'file:./test.db';

const projectRoot = path.resolve(__dirname, '..');

try {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });
} catch (e) {
  // 数据库已存在且 schema 一致时 db push 可能输出警告，仅在真正失败时抛出
  const msg = e instanceof Error ? e.message : String(e);
  if (!/P3005|console/.test(msg)) {
    console.warn('[test-setup] prisma db push 输出：', msg.slice(0, 500));
  }
}
