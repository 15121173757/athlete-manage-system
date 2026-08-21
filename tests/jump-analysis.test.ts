/**
 * 视频跳跃分析 —— 单元 + 集成测试
 *
 * 覆盖：
 * 1. 纯计算函数：飞行时间→高度（h = g·t²/8）、起跳速度、RSI、10-5 汇总、帧换算
 * 2. 服务层：单跳 / DJ / 10-5 创建与派生值重算、参数校验、列表查询（按运动员/日期）、删除
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  computeSingleJumpMetrics,
  flightTimeToHeight,
  flightTimeToTakeoffVelocity,
  frameToTimeMs,
  heightAndContactToRsi,
  heightAndFlightTimeToRsiMod,
  summarizeRepeatJumps,
  timeToFrameIndex,
} from '@/lib/sport-science/jump-analysis';
import {
  createJumpAnalysis,
  deleteJumpAnalysis,
  listJumpAnalysis,
} from '@/lib/modules/jump/JumpAnalysisService';
import { BusinessError, NotFoundError } from '@/lib/errors/ErrorPresenter';

let operatorId = 0;
let athleteA = 0;
let athleteB = 0;

beforeAll(async () => {
  await prisma.jumpAnalysisRecord.deleteMany();
  await prisma.auditLog.deleteMany({ where: { action: { contains: 'JUMP_ANALYSIS' } } });
  await prisma.athlete.deleteMany({ where: { name: { in: ['跳跃测试甲', '跳跃测试乙'] } } });
  await prisma.user.deleteMany({ where: { username: 'jump_tester' } });

  const user = await prisma.user.create({
    data: { username: 'jump_tester', passwordHash: 'x', name: '跳跃测试教练', role: 'COACH' },
  });
  operatorId = user.id;

  const a1 = await prisma.athlete.create({
    data: { name: '跳跃测试甲', gender: '男', birthDate: new Date('2000-01-01'), sport: '排球', joinDate: new Date('2020-01-01') },
  });
  const a2 = await prisma.athlete.create({
    data: { name: '跳跃测试乙', gender: '女', birthDate: new Date('2001-01-01'), sport: '篮球', joinDate: new Date('2021-01-01') },
  });
  athleteA = a1.id;
  athleteB = a2.id;
});

afterAll(async () => {
  await prisma.jumpAnalysisRecord.deleteMany();
  await prisma.auditLog.deleteMany({ where: { action: { contains: 'JUMP_ANALYSIS' } } });
  await prisma.athlete.deleteMany({ where: { name: { in: ['跳跃测试甲', '跳跃测试乙'] } } });
  await prisma.user.deleteMany({ where: { username: 'jump_tester' } });
});

// ============================================================
// 1. 纯计算函数
// ============================================================

describe('跳跃分析计算函数', () => {
  it('飞行时间 500ms → 跳跃高度 ≈ 30.65cm（h = g·t²/8）', () => {
    expect(flightTimeToHeight(500)).toBeCloseTo(30.65, 1);
  });

  it('飞行时间 600ms → 跳跃高度 ≈ 44.13cm', () => {
    expect(flightTimeToHeight(600)).toBeCloseTo(44.13, 1);
  });

  it('飞行时间越长，高度单调递增', () => {
    expect(flightTimeToHeight(500)).toBeLessThan(flightTimeToHeight(600));
    expect(flightTimeToHeight(600)).toBeLessThan(flightTimeToHeight(700));
  });

  it('飞行时间 500ms → 起跳速度 ≈ 2.45 m/s（v = g·t/2）', () => {
    expect(flightTimeToTakeoffVelocity(500)).toBeCloseTo(2.45, 1);
  });

  it('computeSingleJumpMetrics：高度 30.65cm + 触地 250ms → RSI ≈ 1.23', () => {
    const m = computeSingleJumpMetrics(500, 250);
    expect(m.flightTimeMs).toBe(500);
    expect(m.jumpHeightCm).toBeCloseTo(30.65, 1);
    expect(m.takeoffVelocity).toBeCloseTo(2.45, 1);
    expect(m.contactTimeMs).toBe(250);
    expect(m.rsi).toBeCloseTo(1.23, 1);
  });

  it('无触地时间时 RSI 为 null（SJ/CMJ 场景）', () => {
    const m = computeSingleJumpMetrics(500);
    expect(m.contactTimeMs).toBeNull();
    expect(m.rsi).toBeNull();
  });

  it('heightAndContactToRsi：30.65cm / 250ms = 1.226', () => {
    expect(heightAndContactToRsi(30.6458, 250)).toBeCloseTo(1.226, 2);
  });

  it('heightAndFlightTimeToRsiMod：30.65cm / 500ms = 0.613（RSI-mod = 高度(m)/飞行时间(s)）', () => {
    expect(heightAndFlightTimeToRsiMod(30.6458, 500)).toBeCloseTo(0.6129, 3);
    // 等价于 g·t/8 = 9.80665 × 0.5 / 8 = 0.6129
    expect(heightAndFlightTimeToRsiMod(30.6458, 500)).toBeCloseTo((9.80665 * 0.5) / 8, 3);
  });

  it('computeSingleJumpMetrics：单跳指标包含 rsiMod（500ms → 0.61）', () => {
    const m = computeSingleJumpMetrics(500, 250);
    expect(m.rsiMod).toBeCloseTo(0.61, 1);
    expect(m.rsiMod).not.toBeNull();
  });

  it('summarizeRepeatJumps：多跳汇总出平均 RSI-mod 与 RSI-mod 变异系数', () => {
    const summary = summarizeRepeatJumps([
      { flightTimeMs: 500, contactTimeMs: 250 },
      { flightTimeMs: 600, contactTimeMs: 300 },
    ]);
    // 0.61 与 0.74 → 平均 0.68
    expect(summary.avgRsiMod).toBeCloseTo(0.68, 1);
    expect(summary.rsiModCv).not.toBeNull();
    expect(summary.rsiModCv!).toBeGreaterThan(0);
    // 明细携带逐跳 rsiMod
    expect(summary).toHaveProperty('jumpCount');
  });

  it('summarizeRepeatJumps：完全一致的跳跃 → RSI-mod 变异系数 = 0', () => {
    const summary = summarizeRepeatJumps([
      { flightTimeMs: 500, contactTimeMs: 250 },
      { flightTimeMs: 500, contactTimeMs: 250 },
    ]);
    expect(summary.avgRsiMod).toBeCloseTo(0.61, 1);
    expect(summary.rsiModCv).toBe(0);
  });

  it('summarizeRepeatJumps：多跳汇总出平均/最佳高度、平均 RSI 与 CV', () => {
    const summary = summarizeRepeatJumps([
      { flightTimeMs: 500, contactTimeMs: 250 },
      { flightTimeMs: 600, contactTimeMs: 300 },
    ]);
    expect(summary.jumpCount).toBe(2);
    expect(summary.avgHeightCm).toBeCloseTo(37.39, 1);
    expect(summary.bestHeightCm).toBeCloseTo(44.13, 1);
    expect(summary.avgRsi).toBeCloseTo(1.35, 1);
    // 变异系数 > 0（两次 RSI 不同）
    expect(summary.rsiCv).not.toBeNull();
    expect(summary.rsiCv!).toBeGreaterThan(0);
  });

  it('summarizeRepeatJumps：完全一致的跳跃 → CV = 0', () => {
    const summary = summarizeRepeatJumps([
      { flightTimeMs: 500, contactTimeMs: 250 },
      { flightTimeMs: 500, contactTimeMs: 250 },
      { flightTimeMs: 500, contactTimeMs: 250 },
    ]);
    expect(summary.avgHeightCm).toBeCloseTo(30.65, 1);
    expect(summary.bestHeightCm).toBeCloseTo(30.65, 1);
    expect(summary.rsiCv).toBe(0);
  });

  it('帧换算：120fps 下第 12 帧 = 100ms；100ms → 第 12 帧', () => {
    expect(frameToTimeMs(12, 120)).toBeCloseTo(100, 0);
    expect(timeToFrameIndex(100, 120)).toBe(12);
  });

  it('帧换算：非法帧率返回 0', () => {
    expect(frameToTimeMs(5, 0)).toBe(0);
    expect(timeToFrameIndex(100, -1)).toBe(0);
  });
});

// ============================================================
// 2. 服务层集成
// ============================================================

describe('跳跃分析服务层', () => {
  it('创建 CMJ 单跳：服务端重算高度与起跳速度', async () => {
    const rec = await createJumpAnalysis(
      { athleteId: athleteA, testType: 'CMJ', testDate: '2026-08-10', flightTimeMs: 500, videoFps: 120, notes: '热身充分' },
      operatorId
    );
    expect(rec.id).toBeGreaterThan(0);
    expect(rec.jumpHeightCm).toBeCloseTo(30.65, 1);
    expect(rec.takeoffVelocity).toBeCloseTo(2.45, 1);
    expect(rec.flightTimeMs).toBe(500);
    expect(rec.contactTimeMs).toBeNull();
    expect(rec.rsi).toBeNull();
  });

  it('创建 DJ：计算触地时间与 RSI', async () => {
    const rec = await createJumpAnalysis(
      { athleteId: athleteA, testType: 'DJ', testDate: '2026-08-10', flightTimeMs: 500, contactTimeMs: 250 },
      operatorId
    );
    expect(rec.jumpHeightCm).toBeCloseTo(30.65, 1);
    expect(rec.contactTimeMs).toBe(250);
    expect(rec.rsi).toBeCloseTo(1.23, 1);
  });

  it('创建 10-5 重复跳：汇总平均/最佳高度与逐跳明细重算', async () => {
    const rec = await createJumpAnalysis(
      {
        athleteId: athleteA,
        testType: 'REPEAT_10_5',
        testDate: '2026-08-11',
        details: [
          { index: 1, flightTimeMs: 500, contactTimeMs: 250 },
          { index: 2, flightTimeMs: 600, contactTimeMs: 300 },
        ],
      },
      operatorId
    );
    expect(rec.jumpCount).toBe(2);
    expect(rec.avgHeightCm).toBeCloseTo(37.39, 1);
    expect(rec.bestHeightCm).toBeCloseTo(44.13, 1);
    expect(rec.avgRsi).toBeCloseTo(1.35, 1);
    // 明细由服务端重算派生值
    const details = JSON.parse(rec.details) as { index: number; jumpHeightCm: number }[];
    expect(details[0].jumpHeightCm).toBeCloseTo(30.65, 1);
    expect(details[1].jumpHeightCm).toBeCloseTo(44.13, 1);
  });

  it('创建 10-5 重复跳：逐跳明细包含 RSI-mod，列表查询返回该字段', async () => {
    const rec = await createJumpAnalysis(
      {
        athleteId: athleteA,
        testType: 'REPEAT_10_5',
        testDate: '2026-08-11',
        details: [
          { index: 1, flightTimeMs: 500, contactTimeMs: 250 },
          { index: 2, flightTimeMs: 600, contactTimeMs: 300 },
        ],
      },
      operatorId
    );
    // 服务端重算的明细含逐跳 RSI-mod（0.61 / 0.74）
    const details = JSON.parse(rec.details) as { rsi: number | null; rsiMod: number | null }[];
    expect(details[0].rsiMod).toBeCloseTo(0.61, 1);
    expect(details[1].rsiMod).toBeCloseTo(0.74, 1);
    // 列表查询同样带出逐跳 RSI-mod
    const list = await listJumpAnalysis({ athleteId: athleteA, testType: 'REPEAT_10_5' });
    const item = list.find((x) => x.id === rec.id);
    expect(item).toBeDefined();
    expect(item!.details[0].rsiMod).toBeCloseTo(0.61, 1);
    expect(item!.details[1].rsiMod).toBeCloseTo(0.74, 1);
  });

  it('创建 CMJ 单跳多跳（连续 3 次）：主字段存最佳高度那一跳，details 完整入库', async () => {
    const rec = await createJumpAnalysis(
      {
        athleteId: athleteA,
        testType: 'CMJ',
        testDate: '2026-08-12',
        flightTimeMs: 1400, // 顶层取最佳一跳的飞行时间（前端契约）
        details: [
          { index: 1, flightTimeMs: 1000 },
          { index: 2, flightTimeMs: 1200 },
          { index: 3, flightTimeMs: 1400 },
        ],
      },
      operatorId
    );
    // 主字段 = 最佳高度（第 3 次，1400ms）
    expect(rec.jumpCount).toBe(3);
    expect(rec.flightTimeMs).toBe(1400);
    expect(rec.jumpHeightCm).toBeCloseTo(240.26, 1);
    expect(rec.takeoffVelocity).toBeCloseTo(6.86, 1);
    // 汇总
    expect(rec.bestHeightCm).toBeCloseTo(240.26, 1);
    expect(rec.avgHeightCm).toBeCloseTo(179.79, 1);
    expect(rec.avgRsi).toBeNull(); // CMJ 无触地时间 → RSI 为空
    // 逐跳明细完整，序号 1/2/3
    const details = JSON.parse(rec.details) as {
      index: number;
      flightTimeMs: number;
      jumpHeightCm: number;
      takeoffVelocity: number;
    }[];
    expect(details).toHaveLength(3);
    expect(details.map((d) => d.index)).toEqual([1, 2, 3]);
    expect(details[0].jumpHeightCm).toBeCloseTo(122.58, 1);
    expect(details[1].jumpHeightCm).toBeCloseTo(176.52, 1);
    expect(details[2].jumpHeightCm).toBeCloseTo(240.26, 1);
    expect(details[2].takeoffVelocity).toBeCloseTo(6.86, 1);
  });

  it('创建 DJ 单跳多跳：含触地时间的逐跳 RSI 重算与下落高度入库', async () => {
    const rec = await createJumpAnalysis(
      {
        athleteId: athleteA,
        testType: 'DJ',
        testDate: '2026-08-12',
        flightTimeMs: 600,
        contactTimeMs: 300,
        dropHeightCm: 40,
        details: [
          { index: 1, flightTimeMs: 500, contactTimeMs: 250 },
          { index: 2, flightTimeMs: 600, contactTimeMs: 300 },
        ],
      },
      operatorId
    );
    expect(rec.jumpCount).toBe(2);
    expect(rec.flightTimeMs).toBe(600);
    expect(rec.rsi).toBeCloseTo(1.47, 1); // 44.13cm / 300ms
    expect(rec.dropHeightCm).toBe(40);
    expect(rec.avgRsi).not.toBeNull();
    const details = JSON.parse(rec.details) as { rsi: number | null }[];
    expect(details[0].rsi).toBeCloseTo(1.23, 1);
    expect(details[1].rsi).toBeCloseTo(1.47, 1);
  });

  it('校验：DJ 下落高度非法（0 / 非整数 / 超范围）报错', async () => {
    for (const bad of [0, 1.5, 201, -10]) {
      await expect(
        createJumpAnalysis(
          {
            athleteId: athleteA,
            testType: 'DJ',
            testDate: '2026-08-12',
            flightTimeMs: 600,
            dropHeightCm: bad,
          },
          operatorId
        )
      ).rejects.toThrow('下落高度');
    }
  });

  it('校验：非 DJ 类型即使传下落高度也不入库', async () => {
    const rec = await createJumpAnalysis(
      {
        athleteId: athleteA,
        testType: 'CMJ',
        testDate: '2026-08-12',
        flightTimeMs: 600,
        dropHeightCm: 40,
      },
      operatorId
    );
    expect(rec.dropHeightCm).toBeNull();
  });

  it('列表查询：DJ 记录返回下落高度字段', async () => {
    const list = await listJumpAnalysis({ athleteId: athleteA, testType: 'DJ' });
    const withDrop = list.find((item) => item.dropHeightCm != null);
    expect(withDrop).toBeDefined();
    expect(withDrop!.dropHeightCm).toBe(40);
  });

  it('校验：单跳多跳缺少顶层 flightTimeMs 仍报错（前端必须补齐主指标字段）', async () => {
    await expect(
      createJumpAnalysis(
        {
          athleteId: athleteA,
          testType: 'CMJ',
          testDate: '2026-08-12',
          details: [
            { index: 1, flightTimeMs: 1000 },
            { index: 2, flightTimeMs: 1200 },
          ],
        },
        operatorId
      )
    ).rejects.toThrow('飞行时间');
  });

  it('校验：单跳多跳明细超过 20 次报错', async () => {
    const details = Array.from({ length: 21 }, (_, i) => ({ index: i + 1, flightTimeMs: 500 }));
    await expect(
      createJumpAnalysis(
        { athleteId: athleteA, testType: 'CMJ', testDate: '2026-08-12', flightTimeMs: 500, details },
        operatorId
      )
    ).rejects.toThrow('不能超过 20 次');
  });

  it('校验：飞行时间超范围（50ms）报错', async () => {
    await expect(
      createJumpAnalysis({ athleteId: athleteA, testType: 'CMJ', testDate: '2026-08-10', flightTimeMs: 50 }, operatorId)
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('校验：缺少飞行时间报错', async () => {
    await expect(
      createJumpAnalysis({ athleteId: athleteA, testType: 'SJ', testDate: '2026-08-10' }, operatorId)
    ).rejects.toThrow('飞行时间');
  });

  it('校验：未知测试类型报错', async () => {
    await expect(
      createJumpAnalysis({ athleteId: athleteA, testType: 'JUMP' as never, testDate: '2026-08-10', flightTimeMs: 500 }, operatorId)
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('校验：运动员不存在返回 404', async () => {
    await expect(
      createJumpAnalysis({ athleteId: 999999, testType: 'CMJ', testDate: '2026-08-10', flightTimeMs: 500 }, operatorId)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('校验：10-5 明细为空报错', async () => {
    await expect(
      createJumpAnalysis({ athleteId: athleteA, testType: 'REPEAT_10_5', testDate: '2026-08-11', details: [] }, operatorId)
    ).rejects.toThrow('至少需要标记');
  });

  it('列表查询：按运动员过滤，返回关联的运动员姓名', async () => {
    const list = await listJumpAnalysis({ athleteId: athleteA });
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const item of list) {
      expect(item.athleteId).toBe(athleteA);
      expect(item.athleteName).toBe('跳跃测试甲');
    }
  });

  it('列表查询：按测试类型过滤', async () => {
    const list = await listJumpAnalysis({ athleteId: athleteA, testType: 'DJ' });
    expect(list.length).toBe(2);
    for (const item of list) {
      expect(item.testType).toBe('DJ');
    }
  });

  it('列表查询：日期范围过滤（含边界）', async () => {
    const all = await listJumpAnalysis({ athleteId: athleteA });
    const list = await listJumpAnalysis({ athleteId: athleteA, startDate: '2026-08-11', endDate: '2026-08-11' });
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const item of list) {
      expect(item.testDate).toBe('2026-08-11');
    }
    expect(list.length).toBeLessThan(all.length);
  });

  it('删除记录：删除后列表不再包含', async () => {
    const before = await listJumpAnalysis({ athleteId: athleteB });
    const rec = await createJumpAnalysis(
      { athleteId: athleteB, testType: 'SJ', testDate: '2026-08-12', flightTimeMs: 500 },
      operatorId
    );
    await deleteJumpAnalysis(rec.id, operatorId);
    const after = await listJumpAnalysis({ athleteId: athleteB });
    expect(after.length).toBe(before.length);
    expect(after.some((i) => i.id === rec.id)).toBe(false);
  });

  it('删除不存在记录返回 404', async () => {
    await expect(deleteJumpAnalysis(999999, operatorId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('历史数据默认值：未填写的派生指标为 null（兼容历史记录）', async () => {
    const rec = await createJumpAnalysis(
      { athleteId: athleteB, testType: 'CMJ', testDate: '2026-08-13', flightTimeMs: 500 },
      operatorId
    );
    expect(rec.contactTimeMs).toBeNull();
    expect(rec.rsi).toBeNull();
    expect(rec.jumpCount).toBeNull();
    expect(rec.avgHeightCm).toBeNull();
  });
});
