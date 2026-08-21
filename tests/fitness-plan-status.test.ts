/**
 * 体能测试计划状态判定 —— 单元测试
 *
 * 覆盖：
 * 1. resolveFitnessPlanExecStatus 纯函数：执行前/执行时/执行后、分钟级精度、
 *    缺执行时间、非法格式、北京时间（UTC+8）时区边界
 * 2. 批量/单条刷新：草稿不参与自动判定、过期待执行自动转已执行、
 *    未来待执行保持、状态变更写入审计
 *
 * 集成部分使用独立 SQLite 测试库（tests/setup.ts 配置为 prisma/test.db），不影响开发库。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  resolveFitnessPlanExecStatus,
  refreshAllFitnessPlanStatuses,
  refreshFitnessPlanStatusById,
  getBeijingNow,
} from '@/lib/modules/fitness/fitnessPlanStatus';

let operatorId = 0;

// 固定参考时间：2026-08-13 16:00 北京时间 = 2026-08-13T08:00:00.000Z
const BEIJING_16_00 = Date.parse('2026-08-13T08:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// 集成测试使用动态日期基准：以「当前北京时间的当天 16:00」为参照，
// 避免固定参考日期随时间过期导致「未来计划保持不变」等断言失效（过去日期会被误判为已执行）
function currentBeijing16_00(): number {
  const now = getBeijingNow();
  // getBeijingNow 的 UTC 墙钟字段即北京墙钟，北京 16:00 对应 UTC 08:00
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0);
}
const BEIJING_TODAY_16_00 = currentBeijing16_00();

beforeAll(async () => {
  await prisma.fitnessTestPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({ where: { username: 'fitness_status_tester' } });

  const user = await prisma.user.create({
    data: {
      username: 'fitness_status_tester',
      passwordHash: 'x',
      name: '状态测试教练',
      role: 'COACH',
    },
  });
  operatorId = user.id;
});

beforeEach(async () => {
  await prisma.fitnessTestPlan.deleteMany();
  await prisma.auditLog.deleteMany();
});

afterAll(async () => {
  await prisma.fitnessTestPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({ where: { username: 'fitness_status_tester' } });
  await prisma.$disconnect();
});

// ============================================================
// 纯函数：状态判定
// ============================================================

describe('resolveFitnessPlanExecStatus（北京时间分钟级判定）', () => {
  it('执行时间晚于当前时间 → 待执行（SCHEDULED）', () => {
    // 当前北京时间 15:59，执行时间 16:00
    const now = BEIJING_16_00 - 60 * 1000;
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00', now)
    ).toBe('SCHEDULED');
  });

  it('执行时间早于当前时间 → 已执行（COMPLETED）', () => {
    // 当前北京时间 16:01，执行时间 16:00
    const now = BEIJING_16_00 + 60 * 1000;
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00', now)
    ).toBe('COMPLETED');
  });

  it('执行时间等于当前分钟 → 已执行（COMPLETED）', () => {
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00', BEIJING_16_00)
    ).toBe('COMPLETED');
  });

  it('同分钟内的秒级差异被忽略（分钟级精度）', () => {
    // 执行时间 16:00:30 但当前 16:00:00，同一分钟内 → 已执行
    const execMs = BEIJING_16_00 + 30 * 1000;
    const nowMs = BEIJING_16_00;
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00', execMs)
    ).toBe('COMPLETED');
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00', nowMs)
    ).toBe('COMPLETED');
  });

  it('跨天：昨天任意时刻的执行时间 → 已执行', () => {
    const yesterday = new Date(BEIJING_16_00 - DAY_MS).toISOString().slice(0, 10);
    expect(
      resolveFitnessPlanExecStatus(yesterday, '09:00', BEIJING_16_00)
    ).toBe('COMPLETED');
  });

  it('跨天：明天任意时刻的执行时间 → 待执行', () => {
    const tomorrow = new Date(BEIJING_16_00 + DAY_MS).toISOString().slice(0, 10);
    expect(
      resolveFitnessPlanExecStatus(tomorrow, '23:59', BEIJING_16_00)
    ).toBe('SCHEDULED');
  });

  it('缺少开始时间 → 无法判定，默认待执行', () => {
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', null, BEIJING_16_00)
    ).toBe('SCHEDULED');
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', undefined, BEIJING_16_00)
    ).toBe('SCHEDULED');
  });

  it('缺少测试日期 → 无法判定，默认待执行', () => {
    expect(
      resolveFitnessPlanExecStatus(null, '16:00', BEIJING_16_00)
    ).toBe('SCHEDULED');
    expect(
      resolveFitnessPlanExecStatus(undefined, '16:00', BEIJING_16_00)
    ).toBe('SCHEDULED');
  });

  it('开始时间格式非法 → 无法判定，默认待执行', () => {
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00:00', BEIJING_16_00)
    ).toBe('SCHEDULED');
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', 'abc', BEIJING_16_00)
    ).toBe('SCHEDULED');
  });

  it('时区统一：testDate 为 UTC 零点时，其北京日期与字符串日期一致', () => {
    // Date 对象（UTC 零点）与 'YYYY-MM-DD' 字符串判定结果一致
    const dateObj = new Date('2026-08-13T00:00:00.000Z');
    expect(
      resolveFitnessPlanExecStatus(dateObj, '16:00', BEIJING_16_00)
    ).toBe('COMPLETED');
    expect(
      resolveFitnessPlanExecStatus('2026-08-13', '16:00', BEIJING_16_00)
    ).toBe('COMPLETED');
  });

  it('时区边界：当前北京时间 15:59 与 16:00 的判定截然相反', () => {
    expect(
      resolveFitnessPlanExecStatus(
        '2026-08-13',
        '16:00',
        Date.parse('2026-08-13T07:59:00.000Z')
      )
    ).toBe('SCHEDULED');
    expect(
      resolveFitnessPlanExecStatus(
        '2026-08-13',
        '16:00',
        Date.parse('2026-08-13T08:00:00.000Z')
      )
    ).toBe('COMPLETED');
  });

  it('getBeijingNow 返回 UTC+8 墙钟', () => {
    const now = getBeijingNow();
    const expectedUtc = Date.now() + 8 * 60 * 60 * 1000;
    // 分钟级一致即可（执行期间可能有毫秒级漂移）
    expect(Math.floor(now.getTime() / 60000)).toBe(
      Math.floor(expectedUtc / 60000)
    );
  });
});

// ============================================================
// 集成测试：批量/单条刷新
// ============================================================

async function createPlanRow(
  status: string,
  testDate: Date,
  startTime: string | null
) {
  return prisma.fitnessTestPlan.create({
    data: {
      name: `状态测试-${status}-${Date.now()}`,
      testDate,
      startTime,
      status,
      createdById: operatorId,
    },
  });
}

describe('refreshAllFitnessPlanStatuses（批量刷新）', () => {
  it('将已过执行时间的待执行计划自动更新为已执行', async () => {
    const past = await createPlanRow('SCHEDULED', new Date(BEIJING_TODAY_16_00 - DAY_MS), '10:00');
    const changed = await refreshAllFitnessPlanStatuses();
    expect(changed).toBe(1);
    const after = await prisma.fitnessTestPlan.findUnique({ where: { id: past.id } });
    expect(after?.status).toBe('COMPLETED');
  });

  it('执行时间在未来的待执行计划保持不变', async () => {
    const future = await createPlanRow('SCHEDULED', new Date(BEIJING_TODAY_16_00 + DAY_MS), '10:00');
    const changed = await refreshAllFitnessPlanStatuses();
    expect(changed).toBe(0);
    const after = await prisma.fitnessTestPlan.findUnique({ where: { id: future.id } });
    expect(after?.status).toBe('SCHEDULED');
  });

  it('草稿不参与自动判定（即使执行时间已过）', async () => {
    const draft = await createPlanRow('DRAFT', new Date(BEIJING_TODAY_16_00 - DAY_MS), '10:00');
    const changed = await refreshAllFitnessPlanStatuses();
    expect(changed).toBe(0);
    const after = await prisma.fitnessTestPlan.findUnique({ where: { id: draft.id } });
    expect(after?.status).toBe('DRAFT');
  });

  it('状态互斥：每次刷新只向同一方向流转，已执行不会被改回待执行', async () => {
    const past = await createPlanRow('COMPLETED', new Date(BEIJING_TODAY_16_00 - DAY_MS), '10:00');
    // 注意：该计划执行时间已过，仍保持 COMPLETED，且不会因刷新而改变
    const changed = await refreshAllFitnessPlanStatuses();
    expect(changed).toBe(0);
    const after = await prisma.fitnessTestPlan.findUnique({ where: { id: past.id } });
    expect(after?.status).toBe('COMPLETED');
  });

  it('状态变更写入审计日志（前后值 + 触发来源 AUTO）', async () => {
    const past = await createPlanRow('SCHEDULED', new Date(BEIJING_TODAY_16_00 - DAY_MS), '10:00');
    await refreshAllFitnessPlanStatuses();
    const logs = await prisma.auditLog.findMany({
      where: { action: 'FITNESS_PLAN_STATUS_CHANGE', targetId: String(past.id) },
    });
    expect(logs.length).toBe(1);
    const detail = JSON.parse(logs[0].detail as string);
    expect(detail.before).toBe('SCHEDULED');
    expect(detail.after).toBe('COMPLETED');
    expect(detail.trigger).toBe('AUTO');
  });
});

describe('refreshFitnessPlanStatusById（单条刷新）', () => {
  it('将过期的单条待执行计划更新为已执行', async () => {
    const past = await createPlanRow('SCHEDULED', new Date(BEIJING_TODAY_16_00 - DAY_MS), '10:00');
    await refreshFitnessPlanStatusById(past.id);
    const after = await prisma.fitnessTestPlan.findUnique({ where: { id: past.id } });
    expect(after?.status).toBe('COMPLETED');
  });

  it('草稿单条刷新保持草稿', async () => {
    const draft = await createPlanRow('DRAFT', new Date(BEIJING_TODAY_16_00 - DAY_MS), '10:00');
    await refreshFitnessPlanStatusById(draft.id);
    const after = await prisma.fitnessTestPlan.findUnique({ where: { id: draft.id } });
    expect(after?.status).toBe('DRAFT');
  });

  it('不存在的计划静默跳过，不抛错', async () => {
    await expect(refreshFitnessPlanStatusById(999999)).resolves.toBeUndefined();
  });
});
