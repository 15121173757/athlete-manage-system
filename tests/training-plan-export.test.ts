/**
 * 训练计划导出（按运动员筛选）—— 集成测试
 *
 * 覆盖场景：
 * 1. 独立配置计划：导出指定运动员时仅包含该运动员的练习项，不包含其他运动员内容
 * 2. 共享配置计划（历史兼容）：athleteId 为空的练习全员共用，导出时全部保留
 * 3. 运动员未被分配至计划时拒绝导出
 *
 * 通过解析导出的 Excel 文件内容验证数据筛选正确性，防止回归。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db/prisma';
import { createTrainingPlan } from '@/lib/modules/training/TrainingService';
import { exportTrainingPlanForAthlete } from '@/lib/modules/io/ExportService';
import { NotFoundError } from '@/lib/errors/ErrorPresenter';

let coachId = 0;
let athleteA = 0;
let athleteB = 0;
let exerciseBench = 0;
let exerciseSquat = 0;
let exerciseDeadlift = 0;

/** 未来 100 天日期（确保状态为 SCHEDULED，避免触发已完成数据补录） */
function futureDate(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const START_DATE = futureDate(100);

const TEST_EXERCISE_NAMES = ['测试卧推-导出', '测试深蹲-导出', '测试硬拉-导出'];
const TEST_ATHLETE_NAMES = ['导出甲', '导出乙'];

/** 解析导出 Excel 中「训练内容」明细行 */
function readPlanExcelRows(buffer: Buffer): Array<Record<string, unknown>> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['训练内容'];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
}

beforeAll(async () => {
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: TEST_EXERCISE_NAMES } } });
  await prisma.athlete.deleteMany({ where: { name: { in: TEST_ATHLETE_NAMES } } });
  await prisma.user.deleteMany({ where: { username: 'plan_export_tester' } });

  const coach = await prisma.user.create({
    data: { username: 'plan_export_tester', passwordHash: 'x', name: '导出测试教练', role: 'COACH' },
  });
  coachId = coach.id;

  const a1 = await prisma.athlete.create({
    data: { name: '导出甲', gender: '男', birthDate: new Date('2000-01-01'), sport: '力量举', joinDate: new Date('2020-01-01') },
  });
  athleteA = a1.id;
  const a2 = await prisma.athlete.create({
    data: { name: '导出乙', gender: '女', birthDate: new Date('2001-02-02'), sport: '田径', joinDate: new Date('2021-01-01') },
  });
  athleteB = a2.id;

  const ex1 = await prisma.exercise.create({ data: { name: '测试卧推-导出', category: '力量', unit: 'kg' } });
  exerciseBench = ex1.id;
  const ex2 = await prisma.exercise.create({ data: { name: '测试深蹲-导出', category: '力量', unit: 'kg' } });
  exerciseSquat = ex2.id;
  const ex3 = await prisma.exercise.create({ data: { name: '测试硬拉-导出', category: '力量', unit: 'kg' } });
  exerciseDeadlift = ex3.id;
});

beforeEach(async () => {
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
});

afterAll(async () => {
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: TEST_EXERCISE_NAMES } } });
  await prisma.athlete.deleteMany({ where: { name: { in: TEST_ATHLETE_NAMES } } });
  await prisma.user.deleteMany({ where: { username: 'plan_export_tester' } });
  await prisma.$disconnect();
});

describe('训练计划导出：按运动员筛选练习内容', () => {
  it('独立配置：导出甲只含其本人练习（卧推、深蹲），不含乙的硬拉', async () => {
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA, athleteB],
        startDate: START_DATE,
        startTime: '10:00',
        items: [
          { athleteId: athleteA, exerciseId: exerciseBench, sets: 4, reps: 8, load: 60, tempo: '2-0-1-0', sortOrder: 0 },
          { athleteId: athleteA, exerciseId: exerciseSquat, sets: 5, reps: 5, load: 100, sortOrder: 1 },
          { athleteId: athleteB, exerciseId: exerciseDeadlift, sets: 3, reps: 6, load: 120, tempo: '3-0-2-0', sortOrder: 0 },
        ],
      },
      coachId
    );

    const buffer = await exportTrainingPlanForAthlete(plan.id, athleteA, START_DATE, 'excel');
    const rows = readPlanExcelRows(buffer);
    const names = rows.map((r) => r['训练项目']);
    expect(names).toContain('测试卧推-导出');
    expect(names).toContain('测试深蹲-导出');
    expect(names).not.toContain('测试硬拉-导出');
    expect(rows).toHaveLength(2);
  });

  it('独立配置：导出乙只含其本人练习（硬拉），不含甲的卧推与深蹲', async () => {
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA, athleteB],
        startDate: START_DATE,
        startTime: '10:00',
        items: [
          { athleteId: athleteA, exerciseId: exerciseBench, sets: 4, reps: 8, sortOrder: 0 },
          { athleteId: athleteA, exerciseId: exerciseSquat, sets: 5, reps: 5, sortOrder: 1 },
          { athleteId: athleteB, exerciseId: exerciseDeadlift, sets: 3, reps: 6, sortOrder: 0 },
        ],
      },
      coachId
    );

    const buffer = await exportTrainingPlanForAthlete(plan.id, athleteB, START_DATE, 'excel');
    const rows = readPlanExcelRows(buffer);
    const names = rows.map((r) => r['训练项目']);
    expect(names).toEqual(['测试硬拉-导出']);
    expect(rows).toHaveLength(1);
  });

  it('共享配置（历史数据）：athleteId 为空时全员共用，导出任一人均包含该练习', async () => {
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA, athleteB],
        startDate: START_DATE,
        startTime: '10:00',
        items: [{ exerciseId: exerciseBench, sets: 4, reps: 10, tempo: '2-0-1-0' }],
      },
      coachId
    );

    const bufferA = await exportTrainingPlanForAthlete(plan.id, athleteA, START_DATE, 'excel');
    const bufferB = await exportTrainingPlanForAthlete(plan.id, athleteB, START_DATE, 'excel');
    expect(readPlanExcelRows(bufferA).map((r) => r['训练项目'])).toEqual(['测试卧推-导出']);
    expect(readPlanExcelRows(bufferB).map((r) => r['训练项目'])).toEqual(['测试卧推-导出']);
  });

  it('运动员未被分配至计划时拒绝导出', async () => {
    // 仅甲被分配，导出乙应被拒绝
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA],
        startDate: START_DATE,
        startTime: '10:00',
        items: [{ athleteId: athleteA, exerciseId: exerciseBench, sets: 4, reps: 8 }],
      },
      coachId
    );

    await expect(
      exportTrainingPlanForAthlete(plan.id, athleteB, START_DATE, 'excel')
    ).rejects.toBeInstanceOf(NotFoundError);

    // API 层应返回 4xx（404），而非 500 内部错误
    await expect(
      exportTrainingPlanForAthlete(plan.id, athleteB, START_DATE, 'excel')
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });
});
