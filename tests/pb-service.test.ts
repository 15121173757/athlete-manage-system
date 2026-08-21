/**
 * PB 纪录服务 —— 集成测试（使用独立 SQLite 测试库 prisma/test.db）
 *
 * 覆盖目标（对应「部分运动员 PB 未显示」问题的排查与修复验证）：
 * 1. 数据生成链路：训练记录自动生成 PB、更新方向（HIGHER_BETTER / LOWER_BETTER）、
 *    不可追踪项目不生成 PB
 * 2. 查询完整性：无过滤返回全部 + 关联字段完整、按运动员/项目/分类过滤、分页正确
 * 3. 按运动员查询：返回该运动员全部 PB（详情页展示无截断）
 * 4. 手动录入：首次创建、已有更高 PB 时拒绝覆盖
 * 5. 重算覆盖完整性：所有有可追踪训练记录的运动员都能生成 PB（确保列表完整展示）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  updatePBOnRecord,
  listPersonalBests,
  listPBsByAthlete,
  createManualPB,
  recomputeAllPBs,
} from '@/lib/modules/pb/PBService';

// 本测试创建的数据统一使用前缀，便于清理且不与业务数据混淆
const created = { athletes: [] as number[], exercises: [], users: [] as number[] };

let seq = 0;
const unique = (prefix: string) => `${prefix}_${Date.now()}_${++seq}`;

async function createAthlete(sport = '篮球') {
  const a = await prisma.athlete.create({
    data: {
      name: unique('pb_athlete'),
      gender: '男',
      birthDate: new Date('2000-01-01'),
      sport,
      joinDate: new Date('2024-01-01'),
    },
  });
  created.athletes.push(a.id);
  return a;
}

async function createExercise(
  opts: { category?: string; unit?: string; isPBTrackable?: boolean; trackType?: string } = {}
) {
  const e = await prisma.exercise.create({
    data: {
      name: unique('pb_ex'),
      category: opts.category ?? '力量',
      unit: opts.unit ?? 'kg',
      isPBTrackable: opts.isPBTrackable ?? true,
      trackType: opts.trackType ?? 'MAX_WEIGHT',
    },
  });
  created.exercises.push(e.id);
  return e;
}

async function createOperator() {
  const u = await prisma.user.create({
    data: { username: unique('pb_op'), passwordHash: 'x', name: 'PB 测试教练', role: 'COACH' },
  });
  created.users.push(u.id);
  return u;
}

/** 清理前缀命中的历史遗留数据（支持测试重复执行） */
async function cleanupPrefixes() {
  const exIds = (
    await prisma.exercise.findMany({ where: { name: { startsWith: 'pb_ex_' } }, select: { id: true } })
  ).map((e) => e.id);
  if (exIds.length) {
    await prisma.trainingRecord.deleteMany({ where: { exerciseId: { in: exIds } } });
    await prisma.personalBest.deleteMany({ where: { exerciseId: { in: exIds } } });
    await prisma.exercise.deleteMany({ where: { id: { in: exIds } } });
  }
  const aIds = (
    await prisma.athlete.findMany({ where: { name: { startsWith: 'pb_athlete_' } }, select: { id: true } })
  ).map((a) => a.id);
  if (aIds.length) {
    await prisma.personalBest.deleteMany({ where: { athleteId: { in: aIds } } });
    await prisma.trainingRecord.deleteMany({ where: { athleteId: { in: aIds } } });
    await prisma.athlete.deleteMany({ where: { id: { in: aIds } } });
  }
  const uIds = (
    await prisma.user.findMany({ where: { username: { startsWith: 'pb_op_' } }, select: { id: true } })
  ).map((u) => u.id);
  if (uIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: uIds } } });
    await prisma.user.deleteMany({ where: { id: { in: uIds } } });
  }
}

beforeAll(async () => {
  await cleanupPrefixes();
});

afterAll(async () => {
  if (created.exercises.length) {
    await prisma.trainingRecord.deleteMany({ where: { exerciseId: { in: created.exercises } } });
    await prisma.personalBest.deleteMany({ where: { exerciseId: { in: created.exercises } } });
    await prisma.exercise.deleteMany({ where: { id: { in: created.exercises } } });
  }
  if (created.athletes.length) {
    await prisma.personalBest.deleteMany({ where: { athleteId: { in: created.athletes } } });
    await prisma.trainingRecord.deleteMany({ where: { athleteId: { in: created.athletes } } });
    await prisma.athlete.deleteMany({ where: { id: { in: created.athletes } } });
  }
  if (created.users.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  }
  await prisma.$disconnect();
});

describe('updatePBOnRecord 训练记录自动生成/更新 PB', () => {
  it('新运动员 + 可追踪练习：自动创建 PB，值与关联完整', async () => {
    const athlete = await createAthlete();
    const ex = await createExercise({ category: '力量', unit: 'kg' });

    await updatePBOnRecord({
      id: 999001,
      athleteId: athlete.id,
      exerciseId: ex.id,
      actualSets: 3,
      actualReps: 5,
      actualLoad: 120,
      trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    const pb = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId: athlete.id, exerciseId: ex.id } },
      include: { athlete: true, exercise: true },
    });
    expect(pb).not.toBeNull();
    expect(pb!.value).toBe(120);
    expect(pb!.unit).toBe('kg');
    expect(pb!.athlete.id).toBe(athlete.id);
    expect(pb!.exercise.id).toBe(ex.id);
  });

  it('MAX_WEIGHT（越大越好）：更高值更新 PB，更低值不覆盖', async () => {
    const athlete = await createAthlete();
    const ex = await createExercise();
    const base = {
      athleteId: athlete.id,
      exerciseId: ex.id,
      actualSets: 3,
      actualReps: 5,
      trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    };

    await updatePBOnRecord({ ...base, id: 999002, actualLoad: 100 });
    await updatePBOnRecord({ ...base, id: 999003, actualLoad: 110 }); // 更高 → 更新
    let pb = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId: athlete.id, exerciseId: ex.id } },
    });
    expect(pb!.value).toBe(110);

    await updatePBOnRecord({ ...base, id: 999004, actualLoad: 90 }); // 更低 → 不更新
    pb = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId: athlete.id, exerciseId: ex.id } },
    });
    expect(pb!.value).toBe(110);
  });

  it('MIN_TIME（越小越好）：更小值更新 PB，更大值不覆盖', async () => {
    const athlete = await createAthlete();
    const ex = await createExercise({ unit: '秒', trackType: 'MIN_TIME' });
    const base = {
      athleteId: athlete.id,
      exerciseId: ex.id,
      actualSets: 1,
      actualReps: 1,
      actualLoad: null,
      trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    };

    await updatePBOnRecord({ ...base, id: 999005, metricValue: 12.5 });
    await updatePBOnRecord({ ...base, id: 999006, metricValue: 11.8 }); // 更小 → 更新
    let pb = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId: athlete.id, exerciseId: ex.id } },
    });
    expect(pb!.value).toBe(11.8);

    await updatePBOnRecord({ ...base, id: 999007, metricValue: 13 }); // 更大 → 不更新
    pb = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId: athlete.id, exerciseId: ex.id } },
    });
    expect(pb!.value).toBe(11.8);
  });

  it('不可追踪 PB 的练习：不生成 PB', async () => {
    const athlete = await createAthlete();
    const ex = await createExercise({ isPBTrackable: false });

    await updatePBOnRecord({
      id: 999008,
      athleteId: athlete.id,
      exerciseId: ex.id,
      actualSets: 1,
      actualReps: 10,
      actualLoad: 80,
      trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    const pb = await prisma.personalBest.findUnique({
      where: { athleteId_exerciseId: { athleteId: athlete.id, exerciseId: ex.id } },
    });
    expect(pb).toBeNull();
  });
});

describe('listPersonalBests 通用列表查询（列表页数据完整性）', () => {
  it('无过滤：返回全部 PB 且关联字段完整', async () => {
    const a1 = await createAthlete();
    const a2 = await createAthlete();
    const e1 = await createExercise({ category: '力量' });
    const e2 = await createExercise({ category: '速度与敏捷', unit: '秒', trackType: 'MIN_TIME' });

    await updatePBOnRecord({
      id: 999101, athleteId: a1.id, exerciseId: e1.id,
      actualSets: 3, actualReps: 5, actualLoad: 100, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999102, athleteId: a2.id, exerciseId: e1.id,
      actualSets: 3, actualReps: 5, actualLoad: 90, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999103, athleteId: a1.id, exerciseId: e2.id,
      actualSets: 1, actualReps: 1, actualLoad: null, metricValue: 12, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    const { records, total, totalPages } = await listPersonalBests({ pageSize: 100 });
    const mine = records.filter((r) => r.athlete.id === a1.id || r.athlete.id === a2.id);
    expect(mine.length).toBeGreaterThanOrEqual(3);
    for (const r of mine) {
      expect(r.athlete.name).toBeTruthy();
      expect(r.exercise.name).toBeTruthy();
      expect(typeof r.value).toBe('number');
    }
    expect(total).toBeGreaterThanOrEqual(3);
    expect(totalPages).toBeGreaterThanOrEqual(1);
  });

  it('按运动员 / 项目 / 分类过滤均生效', async () => {
    const a = await createAthlete();
    const strength = await createExercise({ category: '力量' });
    const speed = await createExercise({ category: '速度与敏捷', unit: '秒', trackType: 'MIN_TIME' });

    await updatePBOnRecord({
      id: 999201, athleteId: a.id, exerciseId: strength.id,
      actualSets: 3, actualReps: 5, actualLoad: 80, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999202, athleteId: a.id, exerciseId: speed.id,
      actualSets: 1, actualReps: 1, actualLoad: null, metricValue: 10, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    const byAthlete = await listPersonalBests({ athleteId: a.id });
    expect(byAthlete.total).toBe(2);
    expect(byAthlete.records.every((r) => r.athlete.id === a.id)).toBe(true);

    const byExercise = await listPersonalBests({ exerciseId: strength.id });
    expect(byExercise.records.length).toBeGreaterThanOrEqual(1);
    expect(byExercise.records.every((r) => r.exercise.id === strength.id)).toBe(true);

    const byCategory = await listPersonalBests({ category: '速度与敏捷' });
    expect(byCategory.records.length).toBeGreaterThanOrEqual(1);
    expect(byCategory.records.every((r) => r.exercise.category === '速度与敏捷')).toBe(true);
  });

  it('分页：pageSize 大于总数时返回全部且 totalPages 为 1', async () => {
    const res = await listPersonalBests({ page: 1, pageSize: 1000 });
    expect(res.records.length).toBe(res.total);
    expect(res.totalPages).toBe(1);
  });
});

describe('listPersonalBests 多条件排序', () => {
  it('单字段排序：运动员姓名升序 / 降序', async () => {
    const names = ['sort_a', 'sort_b', 'sort_c'];
    const athletes: { id: number }[] = [];
    for (const n of names) {
      const a = await prisma.athlete.create({
        data: { name: n, gender: '男', birthDate: new Date('2000-01-01'), sport: '篮球', joinDate: new Date('2024-01-01') },
      });
      created.athletes.push(a.id);
      athletes.push(a);
    }
    const ex = await createExercise();
    for (let i = 0; i < athletes.length; i++) {
      await updatePBOnRecord({
        id: 999501 + i, athleteId: athletes[i].id, exerciseId: ex.id,
        actualSets: 3, actualReps: 5, actualLoad: 80 + i * 10, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
      });
    }

    const asc = await listPersonalBests({ sorts: [{ field: 'athlete', direction: 'asc' }] });
    expect(asc.records.filter((r) => names.includes(r.athlete.name)).map((r) => r.athlete.name))
      .toEqual(['sort_a', 'sort_b', 'sort_c']);

    const desc = await listPersonalBests({ sorts: [{ field: 'athlete', direction: 'desc' }] });
    expect(desc.records.filter((r) => names.includes(r.athlete.name)).map((r) => r.athlete.name))
      .toEqual(['sort_c', 'sort_b', 'sort_a']);
  });

  it('多条件排序：先按运动员升序（主），再按成绩降序（次）', async () => {
    const names = ['multi_a', 'multi_b'];
    const athletes: { id: number }[] = [];
    for (const n of names) {
      const a = await prisma.athlete.create({
        data: { name: n, gender: '男', birthDate: new Date('2000-01-01'), sport: '篮球', joinDate: new Date('2024-01-01') },
      });
      created.athletes.push(a.id);
      athletes.push(a);
    }
    const ex1 = await createExercise(); // 力量
    const ex2 = await createExercise({ category: '耐力', unit: '米', trackType: 'MAX_DISTANCE' });

    // multi_a：100（ex1）、50（ex2）；multi_b：90（ex1）、60（ex2）
    await updatePBOnRecord({
      id: 999511, athleteId: athletes[0].id, exerciseId: ex1.id,
      actualSets: 3, actualReps: 5, actualLoad: 100, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999512, athleteId: athletes[0].id, exerciseId: ex2.id,
      actualSets: 1, actualReps: 1, actualLoad: null, metricValue: 50, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999513, athleteId: athletes[1].id, exerciseId: ex1.id,
      actualSets: 3, actualReps: 5, actualLoad: 90, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999514, athleteId: athletes[1].id, exerciseId: ex2.id,
      actualSets: 1, actualReps: 1, actualLoad: null, metricValue: 60, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    const { records } = await listPersonalBests({
      sorts: [
        { field: 'athlete', direction: 'asc' },
        { field: 'value', direction: 'desc' },
      ],
    });
    const mine = records.filter((r) => names.includes(r.athlete.name));
    expect(mine.map((r) => `${r.athlete.name}:${r.value}`)).toEqual([
      'multi_a:100',
      'multi_a:50',
      'multi_b:90',
      'multi_b:60',
    ]);

    // 无排序参数时回到默认排序（成绩降序），验证排序条件可移除
    const { records: defaulted } = await listPersonalBests({});
    const mineDefault = defaulted.filter((r) => names.includes(r.athlete.name));
    expect(mineDefault[0].value).toBeGreaterThanOrEqual(mineDefault[1].value);
    expect(mineDefault[1].value).toBeGreaterThanOrEqual(mineDefault[2].value);
    expect(mineDefault[2].value).toBeGreaterThanOrEqual(mineDefault[3].value);
  });
});

describe('listPBsByAthlete 按运动员查询（详情页展示）', () => {
  it('返回该运动员全部 PB（含关联练习，无截断）', async () => {
    const a = await createAthlete();
    const e1 = await createExercise({ category: '力量' });
    const e2 = await createExercise({ category: '耐力', unit: '秒', trackType: 'MAX_TIME' });

    await updatePBOnRecord({
      id: 999301, athleteId: a.id, exerciseId: e1.id,
      actualSets: 3, actualReps: 5, actualLoad: 60, trainingDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    await updatePBOnRecord({
      id: 999302, athleteId: a.id, exerciseId: e2.id,
      actualSets: 1, actualReps: 1, actualLoad: null, metricValue: 45, trainingDate: new Date('2026-08-02T00:00:00.000Z'),
    });

    const pbs = await listPBsByAthlete(a.id);
    expect(pbs).toHaveLength(2);
    expect(pbs.every((p) => p.exercise)).toBe(true);
  });
});

describe('createManualPB 手动录入', () => {
  it('首次录入创建 PB', async () => {
    const a = await createAthlete();
    const e = await createExercise({ unit: 'kg' });

    const res = await createManualPB({
      athleteId: a.id,
      exerciseId: e.id,
      value: 130,
      achievedDate: new Date('2026-08-05T00:00:00.000Z'),
    });
    expect(res.created).toBe(true);
    expect(res.record.value).toBe(130);
  });

  it('已有更高 PB 时拒绝覆盖', async () => {
    const a = await createAthlete();
    const e = await createExercise({ unit: 'kg' });

    await createManualPB({ athleteId: a.id, exerciseId: e.id, value: 130, achievedDate: new Date('2026-08-05T00:00:00.000Z') });
    await expect(
      createManualPB({ athleteId: a.id, exerciseId: e.id, value: 120, achievedDate: new Date('2026-08-06T00:00:00.000Z') })
    ).rejects.toThrow('已有更高 PB');
  });
});

describe('recomputeAllPBs 基于训练记录重算（覆盖完整性）', () => {
  it('为所有有可追踪训练记录的运动员生成 PB，确保列表完整', async () => {
    // 清空 PB 以模拟「PB 缺失」状态
    await prisma.personalBest.deleteMany({});

    const operator = await createOperator();
    const athletes = [await createAthlete(), await createAthlete(), await createAthlete()];
    const ex = await createExercise({ category: '力量' });

    for (let i = 0; i < athletes.length; i++) {
      await prisma.trainingRecord.create({
        data: {
          athleteId: athletes[i].id,
          exerciseId: ex.id,
          actualSets: 3,
          actualReps: 5,
          actualLoad: 100 + i * 10,
          trainingDate: new Date(`2026-07-${10 + i}T00:00:00.000Z`),
          recordedById: operator.id,
        },
      });
    }

    const result = await recomputeAllPBs();
    expect(result.recomputed).toBeGreaterThanOrEqual(athletes.length);

    // 核心断言：每个有训练记录的运动员都必须存在对应 PB（不遗漏）
    for (const a of athletes) {
      const pb = await prisma.personalBest.findUnique({
        where: { athleteId_exerciseId: { athleteId: a.id, exerciseId: ex.id } },
      });
      expect(pb).not.toBeNull();
      expect(pb!.value).toBe(100 + athletes.indexOf(a) * 10);
    }
  });
});
