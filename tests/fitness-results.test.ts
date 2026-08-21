/**
 * 体能测试成绩录入 —— 单元/集成测试
 *
 * 覆盖：
 * 1. 保存前置约束：仅「已执行」计划可录入（INVALID_STATE）
 * 2. 三种成绩类型校验：数值型 / 等级型（选项范围）/ 描述型（长度）
 * 3. 数据归属校验：非本计划运动员 / 非本计划测试项目被拒绝
 * 4. 批量保存与 upsert：修改已录成绩原地更新、空值清空（删除行）
 * 5. 查询返回结构：计划 / 参与人员 / 项目（含成绩类型与选项）/ 已录成绩
 * 6. 审计日志写入
 *
 * 集成部分使用独立 SQLite 测试库（tests/setup.ts 配置为 prisma/test.db）。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  getFitnessPlanResults,
  saveFitnessPlanResults,
} from '@/lib/modules/fitness/FitnessService';

// 本测试创建的数据统一使用前缀，便于清理且不与业务数据混淆
const created = { athletes: [] as number[], tests: [], plans: [], users: [] as number[] };

let seq = 0;
const unique = (prefix: string) => `${prefix}_${Date.now()}_${++seq}`;

let operatorId = 0;
let athlete1Id = 0;
let athlete2Id = 0;
let numericTestId = 0;
let gradeTestId = 0;
let descTestId = 0;
// 每个用例独立的新计划（beforeEach 创建），避免跨用例数据互相干扰
let currentPlanId = 0;

async function createOperator() {
  const u = await prisma.user.create({
    data: { username: unique('fr_op'), passwordHash: 'x', name: '成绩录入测试教练', role: 'COACH' },
  });
  created.users.push(u.id);
  return u;
}

async function createAthlete() {
  const a = await prisma.athlete.create({
    data: {
      name: unique('fr_athlete'),
      gender: '男',
      birthDate: new Date('2000-01-01'),
      sport: '篮球',
      joinDate: new Date('2024-01-01'),
    },
  });
  created.athletes.push(a.id);
  return a;
}

/** 清理前缀命中的历史遗留数据（支持测试重复执行） */
async function cleanupPrefixes() {
  const planIds = (
    await prisma.fitnessTestPlan.findMany({
      where: { name: { startsWith: 'fr_plan' } },
      select: { id: true },
    })
  ).map((p) => p.id);
  if (planIds.length) {
    await prisma.fitnessTestPlan.deleteMany({ where: { id: { in: planIds } } }); // 级联删除 items/participants/results
  }
  const testIds = (
    await prisma.fitnessTest.findMany({ where: { name: { startsWith: 'fr_test' } }, select: { id: true } })
  ).map((t) => t.id);
  if (testIds.length) {
    await prisma.fitnessTest.deleteMany({ where: { id: { in: testIds } } });
  }
  const aIds = (
    await prisma.athlete.findMany({ where: { name: { startsWith: 'fr_athlete' } }, select: { id: true } })
  ).map((a) => a.id);
  if (aIds.length) {
    await prisma.athlete.deleteMany({ where: { id: { in: aIds } } });
  }
  const uIds = (
    await prisma.user.findMany({ where: { username: { startsWith: 'fr_op' } }, select: { id: true } })
  ).map((u) => u.id);
  if (uIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: uIds } } });
    await prisma.user.deleteMany({ where: { id: { in: uIds } } });
  }
}

beforeAll(async () => {
  await cleanupPrefixes();

  const op = await createOperator();
  operatorId = op.id;

  const a1 = await createAthlete();
  const a2 = await createAthlete();
  athlete1Id = a1.id;
  athlete2Id = a2.id;

  const num = await prisma.fitnessTest.create({
    data: { name: unique('fr_test_num'), category: '力量测试', unit: 'kg', resultType: 'NUMERIC' },
  });
  numericTestId = num.id;
  const grade = await prisma.fitnessTest.create({
    data: {
      name: unique('fr_test_grade'),
      category: '灵活性测试',
      unit: '级',
      resultType: 'GRADE',
      gradeOptions: JSON.stringify(['优秀', '良好', '及格']),
    },
  });
  gradeTestId = grade.id;
  const desc = await prisma.fitnessTest.create({
    data: { name: unique('fr_test_desc'), category: '平衡稳定测试', unit: '—', resultType: 'DESCRIPTIVE' },
  });
  descTestId = desc.id;
});

beforeEach(async () => {
  // 每个用例重建一个已执行计划（含 2 名运动员 × 3 个项目），保证互不干扰
  const plan = await prisma.fitnessTestPlan.create({
    data: {
      name: unique('fr_plan'),
      testDate: new Date('2026-08-10'),
      startTime: '09:00',
      status: 'COMPLETED',
      createdById: operatorId,
      items: {
        create: [
          { testId: numericTestId, sortOrder: 1 },
          { testId: gradeTestId, sortOrder: 2 },
          { testId: descTestId, sortOrder: 3 },
        ],
      },
      participants: {
        create: [{ athleteId: athlete1Id }, { athleteId: athlete2Id }],
      },
    },
  });
  created.plans.push(plan.id);
  currentPlanId = plan.id;
});

afterAll(async () => {
  await cleanupPrefixes();
  await prisma.$disconnect();
});

// ============================================================
// 前置约束
// ============================================================

describe('saveFitnessPlanResults（前置约束）', () => {
  it('非「已执行」状态计划拒绝录入', async () => {
    const draft = await prisma.fitnessTestPlan.create({
      data: { name: unique('fr_plan_draft'), testDate: new Date('2026-08-10'), status: 'DRAFT', createdById: operatorId },
    });
    created.plans.push(draft.id);

    await expect(
      saveFitnessPlanResults(draft.id, [{ athleteId: athlete1Id, testId: numericTestId, value: '80' }], operatorId)
    ).rejects.toThrow(/已执行/);
  });

  it('计划不存在返回 NOT_FOUND', async () => {
    await expect(
      saveFitnessPlanResults(999999, [{ athleteId: athlete1Id, testId: numericTestId, value: '80' }], operatorId)
    ).rejects.toThrow(/不存在/);
  });

  it('拒绝非本计划的运动员', async () => {
    const outsider = await createAthlete();
    await expect(
      saveFitnessPlanResults(currentPlanId, [{ athleteId: outsider.id, testId: numericTestId, value: '80' }], operatorId)
    ).rejects.toThrow(/参与人员/);
  });

  it('拒绝非本计划的测试项目', async () => {
    const outsider = await prisma.fitnessTest.create({
      data: { name: unique('fr_test_outsider'), category: '人体测量学', unit: '次', resultType: 'NUMERIC' },
    });
    created.tests.push(outsider.id);
    await expect(
      saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: outsider.id, value: '5' }], operatorId)
    ).rejects.toThrow(/测试项目/);
  });
});

// ============================================================
// 三种成绩类型校验
// ============================================================

describe('saveFitnessPlanResults（成绩类型校验）', () => {
  it('数值型：合法数字保存，非法文本被拒绝', async () => {
    const ok = await saveFitnessPlanResults(
      currentPlanId,
      [{ athleteId: athlete1Id, testId: numericTestId, value: '82.5' }],
      operatorId
    );
    expect(ok).toEqual({ saved: 1, cleared: 0 });

    const saved = await prisma.fitnessTestResult.findUnique({
      where: {
        planId_athleteId_testId: { planId: currentPlanId, athleteId: athlete1Id, testId: numericTestId },
      },
    });
    expect(saved?.value).toBe(82.5);
    expect(saved?.rawValue).toBe('82.5');

    await expect(
      saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: numericTestId, value: 'abc' }], operatorId)
    ).rejects.toThrow(/有效数字/);
  });

  it('等级型：仅允许选项范围内取值', async () => {
    await saveFitnessPlanResults(
      currentPlanId,
      [{ athleteId: athlete1Id, testId: gradeTestId, value: '优秀' }],
      operatorId
    );
    const saved = await prisma.fitnessTestResult.findUnique({
      where: {
        planId_athleteId_testId: { planId: currentPlanId, athleteId: athlete1Id, testId: gradeTestId },
      },
    });
    expect(saved?.gradeValue).toBe('优秀');
    expect(saved?.rawValue).toBe('优秀');

    await expect(
      saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: gradeTestId, value: 'SSS' }], operatorId)
    ).rejects.toThrow(/不在选项范围内/);
  });

  it('描述型：保存文本，超过 500 字被拒绝', async () => {
    const longText = 'x'.repeat(501);
    await saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: descTestId, value: '柔韧性良好，完成度较高' }], operatorId);
    const saved = await prisma.fitnessTestResult.findUnique({
      where: {
        planId_athleteId_testId: { planId: currentPlanId, athleteId: athlete1Id, testId: descTestId },
      },
    });
    expect(saved?.textValue).toBe('柔韧性良好，完成度较高');
    expect(saved?.rawValue).toBe('柔韧性良好，完成度较高');

    await expect(
      saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: descTestId, value: longText }], operatorId)
    ).rejects.toThrow(/500/);
  });
});

// ============================================================
// 批量保存 / upsert / 清空
// ============================================================

describe('saveFitnessPlanResults（批量与修改）', () => {
  it('批量保存多运动员×多项目，并按唯一键去重', async () => {
    const res = await saveFitnessPlanResults(
      currentPlanId,
      [
        { athleteId: athlete1Id, testId: numericTestId, value: '80' },
        { athleteId: athlete1Id, testId: gradeTestId, value: '良好' },
        { athleteId: athlete2Id, testId: numericTestId, value: '75' },
        // 同一 运动员×项目 重复提交：去重后只保留最后一条
        { athleteId: athlete1Id, testId: numericTestId, value: '85' },
      ],
      operatorId
    );
    expect(res).toEqual({ saved: 3, cleared: 0 });

    const count = await prisma.fitnessTestResult.count({ where: { planId: currentPlanId } });
    expect(count).toBe(3);
    const num1 = await prisma.fitnessTestResult.findUnique({
      where: { planId_athleteId_testId: { planId: currentPlanId, athleteId: athlete1Id, testId: numericTestId } },
    });
    expect(num1?.value).toBe(85);
  });

  it('修改已录成绩：upsert 原地更新而非新增', async () => {
    await saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: numericTestId, value: '80' }], operatorId);
    await saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: numericTestId, value: '90' }], operatorId);

    const count = await prisma.fitnessTestResult.count({
      where: { planId: currentPlanId, athleteId: athlete1Id, testId: numericTestId },
    });
    expect(count).toBe(1);
    const saved = await prisma.fitnessTestResult.findUnique({
      where: { planId_athleteId_testId: { planId: currentPlanId, athleteId: athlete1Id, testId: numericTestId } },
    });
    expect(saved?.value).toBe(90);
    expect(saved?.rawValue).toBe('90');
  });

  it('空值清空成绩（删除该行）', async () => {
    await saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: numericTestId, value: '80' }], operatorId);
    const res = await saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: numericTestId, value: '' }], operatorId);
    expect(res).toEqual({ saved: 0, cleared: 1 });

    const count = await prisma.fitnessTestResult.count({
      where: { planId: currentPlanId, athleteId: athlete1Id, testId: numericTestId },
    });
    expect(count).toBe(0);
  });

  it('保存成功写入审计日志（RECORD_FITNESS_RESULTS）', async () => {
    const plan = await prisma.fitnessTestPlan.findUnique({ where: { id: currentPlanId } });
    if (!plan) throw new Error('plan not found');

    await saveFitnessPlanResults(currentPlanId, [{ athleteId: athlete1Id, testId: numericTestId, value: '80' }], operatorId);
    const logs = await prisma.auditLog.findMany({
      where: { action: 'RECORD_FITNESS_RESULTS', targetId: String(currentPlanId), userId: operatorId },
    });
    expect(logs.length).toBe(1);
    const detail = JSON.parse(logs[0].detail as string);
    expect(detail).toEqual({ planName: plan.name, saved: 1, cleared: 0 });
  });
});

// ============================================================
// 查询
// ============================================================

describe('getFitnessPlanResults（查询结构）', () => {
  it('返回计划/参与人员/项目（含成绩类型与选项）/已录成绩', async () => {
    await saveFitnessPlanResults(
      currentPlanId,
      [
        { athleteId: athlete1Id, testId: numericTestId, value: '80' },
        { athleteId: athlete2Id, testId: gradeTestId, value: '及格' },
      ],
      operatorId
    );

    const data = await getFitnessPlanResults(currentPlanId);
    expect(data.plan.id).toBe(currentPlanId);
    expect(data.plan.status).toBe('COMPLETED');
    expect(data.participants.length).toBe(2);
    expect(data.items.length).toBe(3);

    const numItem = data.items.find((i) => i.testId === numericTestId);
    expect(numItem?.resultType).toBe('NUMERIC');
    expect(numItem?.unit).toBe('kg');

    const gradeItem = data.items.find((i) => i.testId === gradeTestId);
    expect(gradeItem?.resultType).toBe('GRADE');
    expect(gradeItem?.gradeOptions).toEqual(['优秀', '良好', '及格']);

    const descItem = data.items.find((i) => i.testId === descTestId);
    expect(descItem?.resultType).toBe('DESCRIPTIVE');

    expect(data.results).toHaveLength(2);
    const r1 = data.results.find((r) => r.athleteId === athlete1Id && r.testId === numericTestId);
    expect(r1?.value).toBe(80);
    expect(r1?.rawValue).toBe('80');
    const r2 = data.results.find((r) => r.athleteId === athlete2Id && r.testId === gradeTestId);
    expect(r2?.gradeValue).toBe('及格');
  });

  it('计划不存在返回 NOT_FOUND', async () => {
    await expect(getFitnessPlanResults(999999)).rejects.toThrow(/不存在/);
  });
});
