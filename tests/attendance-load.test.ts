/**
 * 出勤表 RPE / 训练时长 / 训练负荷 —— 集成测试
 *
 * 覆盖场景：
 * 1. RPE（1-10 整数）与训练时长（非负整数）的范围校验
 * 2. 出勤表写入负荷数据 → 自动同步负荷监控模块（LoadRecord）
 * 3. 负荷监控模块写入 → 反向同步出勤表（双向关联）
 * 4. 按天 upsert：同运动员同一天不产生重复负荷记录
 * 5. 训练负荷自动计算（RPE × 训练时长）并展示在出勤表
 * 6. 训练负荷统计：按日 / 按人员 / 按运动项目多维汇总与筛选
 * 7. 批量导入历史数据：部分成功、非法条目跳过并记录错误、同步出勤表
 * 8. 历史出勤记录默认值：未填写 RPE / 时长时保持 null，不写入负荷监控
 *
 * 日期按北京时间（UTC+8）动态计算，避免测试在未来过期。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  upsertAttendanceRecord,
  listAttendanceSheet,
} from '@/lib/modules/attendance/AttendanceService';
import {
  createLoadRecord,
  getLoadStatistics,
  batchImportLoadRecords,
} from '@/lib/modules/health/LoadService';
import { createTrainingPlan } from '@/lib/modules/training/TrainingService';

/** 北京时间今天（YYYY-MM-DD） */
function beijingToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 出勤表 attendanceDate 的 UTC 零点（与生产存储语义一致） */
function utcMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const TODAY = beijingToday();
const YESTERDAY = addDaysStr(TODAY, -1);
const TWO_DAYS_AGO = addDaysStr(TODAY, -2);

let coachId = 0;
let athleteA = 0;
let athleteB = 0;
let exerciseId = 0;

beforeAll(async () => {
  await prisma.attendanceRecord.deleteMany();
  await prisma.loadRecord.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: ['测试负荷深蹲'] } } });
  await prisma.athlete.deleteMany({ where: { name: { in: ['负荷测试甲', '负荷测试乙'] } } });
  await prisma.user.deleteMany({ where: { username: 'load_tester' } });

  const coach = await prisma.user.create({
    data: { username: 'load_tester', passwordHash: 'x', name: '负荷测试教练', role: 'COACH' },
  });
  coachId = coach.id;

  const a1 = await prisma.athlete.create({
    data: {
      name: '负荷测试甲',
      gender: '男',
      birthDate: new Date('2000-01-01'),
      sport: '力量举',
      joinDate: new Date('2020-01-01'),
    },
  });
  athleteA = a1.id;
  const a2 = await prisma.athlete.create({
    data: {
      name: '负荷测试乙',
      gender: '女',
      birthDate: new Date('2001-02-02'),
      sport: '田径',
      joinDate: new Date('2021-01-01'),
    },
  });
  athleteB = a2.id;

  const ex = await prisma.exercise.create({ data: { name: '测试负荷深蹲', category: '力量', unit: 'kg' } });
  exerciseId = ex.id;
});

beforeEach(async () => {
  await prisma.attendanceRecord.deleteMany();
  await prisma.loadRecord.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
});

afterAll(async () => {
  await prisma.attendanceRecord.deleteMany();
  await prisma.loadRecord.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: ['测试负荷深蹲'] } } });
  await prisma.athlete.deleteMany({ where: { name: { in: ['负荷测试甲', '负荷测试乙'] } } });
  await prisma.user.deleteMany({ where: { username: 'load_tester' } });
  await prisma.$disconnect();
});

describe('RPE 与训练时长校验', () => {
  it('RPE 低于 1（0）被拒绝', async () => {
    await expect(
      upsertAttendanceRecord({ date: TODAY, athleteId: athleteA, status: 'PRESENT', rpe: 0 }, coachId)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('RPE 高于 10（11）被拒绝', async () => {
    await expect(
      upsertAttendanceRecord({ date: TODAY, athleteId: athleteA, status: 'PRESENT', rpe: 11 }, coachId)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('RPE 非整数（7.5）被拒绝', async () => {
    await expect(
      upsertAttendanceRecord({ date: TODAY, athleteId: athleteA, status: 'PRESENT', rpe: 7.5 }, coachId)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('训练时长为负数被拒绝', async () => {
    await expect(
      upsertAttendanceRecord(
        { date: TODAY, athleteId: athleteA, status: 'PRESENT', durationMinutes: -5 },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('训练时长为非整数被拒绝', async () => {
    await expect(
      upsertAttendanceRecord(
        { date: TODAY, athleteId: athleteA, status: 'PRESENT', durationMinutes: 30.5 },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('合法 RPE（7）与训练时长（60）正常保存', async () => {
    const rec = await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PRESENT', rpe: 7, durationMinutes: 60 },
      coachId
    );
    expect(rec.rpe).toBe(7);
    expect(rec.durationMinutes).toBe(60);
  });

  it('历史出勤记录默认值：未填写 RPE / 时长时为 null，且不写入负荷监控', async () => {
    const rec = await upsertAttendanceRecord({ date: TODAY, athleteId: athleteA, status: 'PRESENT' }, coachId);
    expect(rec.rpe).toBeNull();
    expect(rec.durationMinutes).toBeNull();
    const loads = await prisma.loadRecord.findMany({ where: { athleteId: athleteA } });
    expect(loads).toHaveLength(0);
  });
});

describe('训练负荷自动计算与双向关联', () => {
  it('出勤表填写 RPE=7、时长=60 → 训练负荷=420 展示，并同步负荷监控', async () => {
    await createTrainingPlan(
      {
        athleteIds: [athleteA],
        startDate: TODAY,
        startTime: '09:00',
        items: [{ exerciseId, sets: 3, reps: 10 }],
      },
      coachId
    );
    await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PRESENT', rpe: 7, durationMinutes: 60 },
      coachId
    );

    const sheet = await listAttendanceSheet(TODAY);
    const row = sheet.rows.find((r) => r.athleteId === athleteA);
    expect(row).toBeDefined();
    expect(row!.rpe).toBe(7);
    expect(row!.durationMinutes).toBe(60);
    expect(row!.load).toBe(420); // RPE × 训练时长

    const load = await prisma.loadRecord.findFirst({ where: { athleteId: athleteA } });
    expect(load).not.toBeNull();
    expect(load!.rpe).toBe(7);
    expect(load!.durationMinutes).toBe(60);
  });

  it('负荷监控写入 RPE=5、时长=45 → 反向同步当天出勤记录', async () => {
    await upsertAttendanceRecord({ date: TODAY, athleteId: athleteA, status: 'PRESENT' }, coachId);
    await createLoadRecord(
      { athleteId: athleteA, recordDate: TODAY, rpe: 5, durationMinutes: 45 },
      coachId
    );

    const rec = await prisma.attendanceRecord.findUnique({
      where: {
        attendanceDate_athleteId: { attendanceDate: utcMidnight(TODAY), athleteId: athleteA },
      },
    });
    expect(rec).not.toBeNull();
    expect(rec!.rpe).toBe(5);
    expect(rec!.durationMinutes).toBe(45);
  });

  it('按天 upsert：同运动员同一天多次写入只保留一条最新负荷记录', async () => {
    await createLoadRecord({ athleteId: athleteA, recordDate: TODAY, rpe: 4, durationMinutes: 30 }, coachId);
    await createLoadRecord({ athleteId: athleteA, recordDate: TODAY, rpe: 6, durationMinutes: 50 }, coachId);

    const recs = await prisma.loadRecord.findMany({ where: { athleteId: athleteA } });
    expect(recs).toHaveLength(1);
    expect(recs[0].rpe).toBe(6);
    expect(recs[0].durationMinutes).toBe(50);
  });

  it('RPE 与训练时长任一为空时不写入负荷监控（避免污染 ACWR）', async () => {
    await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PRESENT', rpe: 7 },
      coachId
    );
    await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PRESENT', durationMinutes: 60 },
      coachId
    );
    const loads = await prisma.loadRecord.findMany({ where: { athleteId: athleteA } });
    expect(loads).toHaveLength(0);
  });
});

describe('训练负荷统计（按日 / 人员 / 项目）', () => {
  it('按日与按人员自动汇总训练负荷', async () => {
    await createLoadRecord({ athleteId: athleteA, recordDate: YESTERDAY, rpe: 7, durationMinutes: 60 }, coachId); // 420
    await createLoadRecord({ athleteId: athleteA, recordDate: TODAY, rpe: 5, durationMinutes: 30 }, coachId); // 150
    await createLoadRecord({ athleteId: athleteB, recordDate: YESTERDAY, rpe: 8, durationMinutes: 45 }, coachId); // 360

    const stats = await getLoadStatistics({ startDate: TWO_DAYS_AGO, endDate: TODAY });
    expect(stats.recordCount).toBe(3);
    expect(stats.athleteCount).toBe(2);
    expect(stats.totalLoad).toBe(930);
    expect(stats.totalDurationMinutes).toBe(135);

    const yesterday = stats.daily.find((d) => d.date === YESTERDAY);
    expect(yesterday).toBeDefined();
    expect(yesterday!.athleteCount).toBe(2);
    expect(yesterday!.totalLoad).toBe(780);
    expect(yesterday!.totalDurationMinutes).toBe(105);
    expect(yesterday!.avgRpe).toBe(7.5);

    const a = stats.athletes.find((x) => x.athleteId === athleteA);
    expect(a).toBeDefined();
    expect(a!.trainingDays).toBe(2);
    expect(a!.totalLoad).toBe(570);
    expect(a!.avgDailyLoad).toBe(285);
    expect(a!.totalDurationMinutes).toBe(90);
  });

  it('按运动员筛选统计', async () => {
    await createLoadRecord({ athleteId: athleteA, recordDate: TODAY, rpe: 7, durationMinutes: 60 }, coachId);
    await createLoadRecord({ athleteId: athleteB, recordDate: TODAY, rpe: 5, durationMinutes: 30 }, coachId);

    const stats = await getLoadStatistics({ startDate: TODAY, endDate: TODAY, athleteId: athleteA });
    expect(stats.recordCount).toBe(1);
    expect(stats.athleteCount).toBe(1);
    expect(stats.totalLoad).toBe(420);
    expect(stats.athletes[0].athleteId).toBe(athleteA);
  });

  it('按运动项目（部门）筛选统计', async () => {
    await createLoadRecord({ athleteId: athleteA, recordDate: TODAY, rpe: 7, durationMinutes: 60 }, coachId);
    await createLoadRecord({ athleteId: athleteB, recordDate: TODAY, rpe: 5, durationMinutes: 30 }, coachId);

    const stats = await getLoadStatistics({ startDate: TODAY, endDate: TODAY, sport: '力量举' });
    expect(stats.recordCount).toBe(1);
    expect(stats.athleteCount).toBe(1);
    expect(stats.totalLoad).toBe(420);
    expect(stats.sport).toBe('力量举');
  });

  it('日期范围之外的数据不参与统计', async () => {
    await createLoadRecord({ athleteId: athleteA, recordDate: TWO_DAYS_AGO, rpe: 7, durationMinutes: 60 }, coachId);
    const stats = await getLoadStatistics({ startDate: YESTERDAY, endDate: TODAY });
    expect(stats.recordCount).toBe(0);
    expect(stats.totalLoad).toBe(0);
  });
});

describe('批量导入历史 RPE 与训练时长', () => {
  it('合法条目全部导入，非法条目跳过并返回错误（部分成功）', async () => {
    const result = await batchImportLoadRecords(
      [
        { athleteId: athleteA, date: TWO_DAYS_AGO, rpe: 7, durationMinutes: 60 },
        { athleteId: athleteA, date: YESTERDAY, rpe: 5, durationMinutes: 30 },
        { athleteId: athleteB, date: TWO_DAYS_AGO, rpe: 11, durationMinutes: 30 }, // RPE 超范围
        { athleteId: 999999, date: TWO_DAYS_AGO, rpe: 5, durationMinutes: 30 }, // 运动员不存在
        { athleteId: athleteB, date: '2026/01/01', rpe: 5, durationMinutes: 30 }, // 日期格式错误
      ],
      coachId
    );

    expect(result.total).toBe(5);
    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.map((e) => e.message)).toContain('RPE 值必须为 1-10 的整数');
    expect(result.errors.map((e) => e.message)).toContain('运动员不存在');
    expect(result.errors.map((e) => e.message)).toContain('日期格式不正确');
  });

  it('导入成功条目按天 upsert：同日重复导入为更新而非新增', async () => {
    await batchImportLoadRecords(
      [{ athleteId: athleteA, date: TWO_DAYS_AGO, rpe: 7, durationMinutes: 60 }],
      coachId
    );
    const result = await batchImportLoadRecords(
      [{ athleteId: athleteA, date: TWO_DAYS_AGO, rpe: 6, durationMinutes: 45 }],
      coachId
    );

    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
    const recs = await prisma.loadRecord.findMany({ where: { athleteId: athleteA } });
    expect(recs).toHaveLength(1);
    expect(recs[0].rpe).toBe(6);
    expect(recs[0].durationMinutes).toBe(45);
  });

  it('批量导入同步出勤表当天已有记录的 RPE 与时长', async () => {
    await upsertAttendanceRecord(
      { date: TWO_DAYS_AGO, athleteId: athleteA, status: 'PRESENT' },
      coachId
    );
    await batchImportLoadRecords(
      [{ athleteId: athleteA, date: TWO_DAYS_AGO, rpe: 7, durationMinutes: 60 }],
      coachId
    );

    const rec = await prisma.attendanceRecord.findUnique({
      where: {
        attendanceDate_athleteId: { attendanceDate: utcMidnight(TWO_DAYS_AGO), athleteId: athleteA },
      },
    });
    expect(rec).not.toBeNull();
    expect(rec!.rpe).toBe(7);
    expect(rec!.durationMinutes).toBe(60);
  });
});
