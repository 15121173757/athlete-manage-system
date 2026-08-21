/**
 * 出勤状态与日期判定 —— 集成测试
 *
 * 覆盖场景：
 * 1. 出勤状态禁止为未来日期标记（明天 / 未来月份）
 * 2. 当天标记出勤状态正常
 * 3. 明日训练计划不进入今日出勤表，只出现在明日出勤表
 * 4. 计划执行状态日期比较边界：今日已过 / 今日未到 / 明日 / 跨月
 *
 * 所有日期按北京时间（Asia/Shanghai，UTC+8）动态计算，避免测试在未来过期。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  upsertAttendanceRecord,
  listAttendanceSheet,
} from '@/lib/modules/attendance/AttendanceService';
import { resolvePlanExecStatus } from '@/lib/modules/training/planStatus';
import { createTrainingPlan } from '@/lib/modules/training/TrainingService';

/** 北京时间今天（YYYY-MM-DD），与生产逻辑一致 */
function beijingToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonthsStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

const TODAY = beijingToday();
const TOMORROW = addDaysStr(TODAY, 1);
const NEXT_MONTH = addMonthsStr(TODAY, 1);

let coachId = 0;
let athleteA = 0;
let athleteB = 0;
let exerciseId = 0;

beforeAll(async () => {
  await prisma.attendanceRecord.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: ['测试出勤深蹲'] } } });
  await prisma.athlete.deleteMany({ where: { name: { in: ['出勤测试甲', '出勤测试乙'] } } });
  await prisma.user.deleteMany({ where: { username: 'attendance_tester' } });

  const coach = await prisma.user.create({
    data: { username: 'attendance_tester', passwordHash: 'x', name: '出勤测试教练', role: 'COACH' },
  });
  coachId = coach.id;

  const a1 = await prisma.athlete.create({
    data: { name: '出勤测试甲', gender: '男', birthDate: new Date('2000-01-01'), sport: '力量举', joinDate: new Date('2020-01-01') },
  });
  athleteA = a1.id;
  const a2 = await prisma.athlete.create({
    data: { name: '出勤测试乙', gender: '女', birthDate: new Date('2001-02-02'), sport: '田径', joinDate: new Date('2021-01-01') },
  });
  athleteB = a2.id;

  const ex = await prisma.exercise.create({ data: { name: '测试出勤深蹲', category: '力量', unit: 'kg' } });
  exerciseId = ex.id;
});

beforeEach(async () => {
  await prisma.attendanceRecord.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
});

afterAll(async () => {
  await prisma.attendanceRecord.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: ['测试出勤深蹲'] } } });
  await prisma.athlete.deleteMany({ where: { name: { in: ['出勤测试甲', '出勤测试乙'] } } });
  await prisma.user.deleteMany({ where: { username: 'attendance_tester' } });
  await prisma.$disconnect();
});

describe('出勤状态更新：禁止为未来日期标记', () => {
  it('明天（今日 +1）标记出勤被拒绝', async () => {
    await expect(
      upsertAttendanceRecord(
        { date: TOMORROW, athleteId: athleteA, status: 'PRESENT' },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('未来月份标记出勤被拒绝（跨月边界）', async () => {
    await expect(
      upsertAttendanceRecord(
        { date: NEXT_MONTH, athleteId: athleteA, status: 'PRESENT' },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('当天标记出勤正常写入', async () => {
    const record = await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PRESENT', notes: '正常出勤' },
      coachId
    );
    expect(record.status).toBe('PRESENT');
    expect(record.athleteId).toBe(athleteA);
    expect(record.attendanceDate.toISOString().slice(0, 10)).toBe(TODAY);
  });

  it('当天写入后不允许跨日期重复（仍只作用于当天）', async () => {
    await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PRESENT' },
      coachId
    );
    // 同一天再次更新为其他状态正常
    const updated = await upsertAttendanceRecord(
      { date: TODAY, athleteId: athleteA, status: 'PERSONAL_LEAVE' },
      coachId
    );
    expect(updated.status).toBe('PERSONAL_LEAVE');
  });
});

describe('出勤表日期匹配：明日计划不进入今日出勤表', () => {
  it('明日训练计划只出现在明日出勤表，今日出勤表不含该运动员', async () => {
    // 明天开始执行的训练计划（运动员甲）
    await createTrainingPlan(
      {
        athleteIds: [athleteA],
        startDate: TOMORROW,
        startTime: '09:00',
        items: [{ exerciseId, sets: 3, reps: 10 }],
      },
      coachId
    );

    const todaySheet = await listAttendanceSheet(TODAY);
    expect(todaySheet.rows.some((r) => r.athleteId === athleteA)).toBe(false);

    const tomorrowSheet = await listAttendanceSheet(TOMORROW);
    const row = tomorrowSheet.rows.find((r) => r.athleteId === athleteA);
    expect(row).toBeDefined();
    expect(row!.source).toBe('PLAN');
    expect(row!.status).toBeNull(); // 明日名单仅列出，状态未标记
  });
});

describe('计划执行状态：日期比较边界', () => {
  it('今日已过执行时间 → 已执行（COMPLETED）', () => {
    const nowNoonMs = Date.parse(`${TODAY}T12:00:00+08:00`);
    expect(resolvePlanExecStatus(TODAY, '09:00', nowNoonMs)).toBe('COMPLETED');
  });

  it('今日尚未到达执行时间 → 待执行（SCHEDULED）', () => {
    const nowMorningMs = Date.parse(`${TODAY}T08:00:00+08:00`);
    expect(resolvePlanExecStatus(TODAY, '09:00', nowMorningMs)).toBe('SCHEDULED');
  });

  it('明日计划在今日任何时刻都保持待执行（不提前判定）', () => {
    const nowNoonMs = Date.parse(`${TODAY}T12:00:00+08:00`);
    expect(resolvePlanExecStatus(TOMORROW, '09:00', nowNoonMs)).toBe('SCHEDULED');
    expect(resolvePlanExecStatus(TOMORROW, '00:01', nowNoonMs)).toBe('SCHEDULED');
  });

  it('跨月：下月计划保持待执行，上月计划已执行', () => {
    const nowNoonMs = Date.parse(`${TODAY}T12:00:00+08:00`);
    expect(resolvePlanExecStatus(NEXT_MONTH, '09:00', nowNoonMs)).toBe('SCHEDULED');
    const lastMonth = addMonthsStr(TODAY, -1);
    expect(resolvePlanExecStatus(lastMonth, '09:00', nowNoonMs)).toBe('COMPLETED');
  });
});
