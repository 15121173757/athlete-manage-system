/**
 * 训练计划练习项（多运动员独立配置 / 节奏参数 / 历史兼容）—— 集成测试
 *
 * 覆盖：
 * 1. 多运动员独立配置：不同运动员各自独立练习项，athleteId 与 tempo 正确持久化
 * 2. 覆盖校验：正式创建时每位运动员至少配置一项练习
 * 3. 规则校验：同一计划不允许混用共享与独立配置；练习指定运动员必须属于计划
 * 4. 草稿放宽：草稿允许某运动员暂无练习项
 * 5. 历史兼容：共享配置（athleteId 为空）仍可用，不影响历史数据
 * 6. 更新与详情：更新后数据一致；详情返回 athlete 关联，支持按运动员分组展示
 *
 * 使用独立 SQLite 测试库（tests/setup.ts 配置为 prisma/test.db），不影响开发库。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  createTrainingPlan,
  updateTrainingPlan,
  getTrainingPlan,
} from '@/lib/modules/training/TrainingService';

let coachId = 0;
let athleteA = 0;
let athleteB = 0;
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

const TEST_EXERCISE_NAMES = ['测试深蹲-计划项', '测试硬拉-计划项'];
const TEST_ATHLETE_NAMES = ['计划项甲', '计划项乙'];

beforeAll(async () => {
  await prisma.trainingPlan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exercise.deleteMany({ where: { name: { in: TEST_EXERCISE_NAMES } } });
  await prisma.athlete.deleteMany({ where: { name: { in: TEST_ATHLETE_NAMES } } });
  await prisma.user.deleteMany({ where: { username: 'plan_items_tester' } });

  const coach = await prisma.user.create({
    data: { username: 'plan_items_tester', passwordHash: 'x', name: '计划项测试教练', role: 'COACH' },
  });
  coachId = coach.id;

  const a1 = await prisma.athlete.create({
    data: { name: '计划项甲', gender: '男', birthDate: new Date('2000-01-01'), sport: '力量举', joinDate: new Date('2020-01-01') },
  });
  athleteA = a1.id;
  const a2 = await prisma.athlete.create({
    data: { name: '计划项乙', gender: '女', birthDate: new Date('2001-02-02'), sport: '田径', joinDate: new Date('2021-01-01') },
  });
  athleteB = a2.id;

  const ex1 = await prisma.exercise.create({ data: { name: '测试深蹲-计划项', category: '力量', unit: 'kg' } });
  exerciseSquat = ex1.id;
  const ex2 = await prisma.exercise.create({ data: { name: '测试硬拉-计划项', category: '力量', unit: 'kg' } });
  exerciseDeadlift = ex2.id;
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
  await prisma.user.deleteMany({ where: { username: 'plan_items_tester' } });
  await prisma.$disconnect();
});

describe('训练计划练习项：多运动员独立配置', () => {
  it('两名运动员各自独立练习项，athleteId / tempo 正确持久化', async () => {
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA, athleteB],
        startDate: START_DATE,
        startTime: '10:00',
        items: [
          { athleteId: athleteA, exerciseId: exerciseSquat, sets: 4, reps: 6, load: 100, tempo: '2-0-1-0', sortOrder: 0, notes: 'A 备注' },
          { athleteId: athleteB, exerciseId: exerciseDeadlift, sets: 3, reps: 8, load: 80, tempo: '3-0-2-0', sortOrder: 0 },
        ],
      },
      coachId
    );

    expect(plan.planAthletes).toHaveLength(2);
    const items = plan.items;
    expect(items).toHaveLength(2);
    const itemA = items.find((i) => i.athleteId === athleteA);
    const itemB = items.find((i) => i.athleteId === athleteB);
    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    expect(itemA!.tempo).toBe('2-0-1-0');
    expect(itemB!.tempo).toBe('3-0-2-0');
    expect(itemA!.notes).toBe('A 备注');
    expect(itemB!.notes).toBeNull();
    // 返回的 athlete 关联信息支持详情页按运动员分组展示
    expect(itemA!.athlete?.name).toBe('计划项甲');
    expect(itemB!.athlete?.name).toBe('计划项乙');
  });

  it('正式创建：某运动员无练习项时拒绝（覆盖校验）', async () => {
    await expect(
      createTrainingPlan(
        {
          athleteIds: [athleteA, athleteB],
          startDate: START_DATE,
          startTime: '10:00',
          items: [{ athleteId: athleteA, exerciseId: exerciseSquat, sets: 3, reps: 10 }],
        },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('同一计划不允许混用共享与独立配置', async () => {
    await expect(
      createTrainingPlan(
        {
          athleteIds: [athleteA],
          startDate: START_DATE,
          startTime: '10:00',
          items: [
            { exerciseId: exerciseSquat, sets: 3, reps: 10 }, // 共享（athleteId 为空）
            { athleteId: athleteA, exerciseId: exerciseDeadlift, sets: 3, reps: 10 }, // 独立
          ],
        },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('练习指定的运动员不在计划范围内时拒绝', async () => {
    await expect(
      createTrainingPlan(
        {
          athleteIds: [athleteA],
          startDate: START_DATE,
          startTime: '10:00',
          items: [{ athleteId: athleteB, exerciseId: exerciseSquat, sets: 3, reps: 10 }],
        },
        coachId
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('草稿允许某运动员暂无练习项（覆盖校验放宽）', async () => {
    const plan = await createTrainingPlan(
      {
        status: 'DRAFT',
        athleteIds: [athleteA, athleteB],
        items: [{ athleteId: athleteA, exerciseId: exerciseSquat, sets: 3, reps: 10 }],
      },
      coachId
    );
    expect(plan.status).toBe('DRAFT');
    expect(plan.items).toHaveLength(1);
  });
});

describe('训练计划练习项：历史兼容（共享配置）', () => {
  it('athleteId 为空的共享配置仍可用，全员共用同一组练习', async () => {
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA, athleteB],
        startDate: START_DATE,
        startTime: '10:00',
        items: [{ exerciseId: exerciseSquat, sets: 3, reps: 10, tempo: '2-0-1-0' }],
      },
      coachId
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].athleteId).toBeNull();
    expect(plan.items[0].tempo).toBe('2-0-1-0');
  });

  it('共享配置更新后仍保持共享（不迁移为独立配置）', async () => {
    const plan = await createTrainingPlan(
      {
        status: 'DRAFT',
        athleteIds: [athleteA],
        items: [{ exerciseId: exerciseSquat, sets: 3, reps: 10 }],
      },
      coachId
    );
    const updated = await updateTrainingPlan(
      plan.id,
      {
        status: 'DRAFT',
        items: [{ exerciseId: exerciseDeadlift, sets: 4, reps: 8, notes: '更新后' }],
      },
      coachId
    );
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].athleteId).toBeNull();
    expect(updated.items[0].exerciseId).toBe(exerciseDeadlift);
    expect(updated.items[0].notes).toBe('更新后');
  });
});

describe('训练计划练习项：更新与详情', () => {
  it('更新计划：独立配置项被替换后重新保存，athleteId / tempo 一致', async () => {
    const plan = await createTrainingPlan(
      {
        status: 'DRAFT',
        athleteIds: [athleteA, athleteB],
        items: [{ athleteId: athleteA, exerciseId: exerciseSquat, sets: 3, reps: 10 }],
      },
      coachId
    );

    const updated = await updateTrainingPlan(
      plan.id,
      {
        status: 'DRAFT',
        items: [
          { athleteId: athleteA, exerciseId: exerciseSquat, sets: 4, reps: 6, load: 120, tempo: '2-0-1-0' },
          { athleteId: athleteB, exerciseId: exerciseDeadlift, sets: 3, reps: 12, tempo: '1-0-2-0' },
        ],
      },
      coachId
    );

    expect(updated.items).toHaveLength(2);
    expect(updated.items.find((i) => i.athleteId === athleteA)?.tempo).toBe('2-0-1-0');
    expect(updated.items.find((i) => i.athleteId === athleteB)?.tempo).toBe('1-0-2-0');
    expect(updated.items.find((i) => i.athleteId === athleteA)?.load).toBe(120);
  });

  it('详情查询：items 返回 athlete 关联信息，支持按运动员分组展示', async () => {
    const plan = await createTrainingPlan(
      {
        athleteIds: [athleteA, athleteB],
        startDate: START_DATE,
        startTime: '10:00',
        items: [
          { athleteId: athleteA, exerciseId: exerciseSquat, sets: 3, reps: 10, sortOrder: 0 },
          { athleteId: athleteB, exerciseId: exerciseDeadlift, sets: 3, reps: 10, sortOrder: 0 },
        ],
      },
      coachId
    );

    const detail = await getTrainingPlan(plan.id);
    const names = detail.items.map((i) => i.athlete?.name);
    expect(names).toEqual(expect.arrayContaining(['计划项甲', '计划项乙']));
  });
});
