/**
 * 伤病管理服务 —— 集成测试
 * 使用独立 SQLite 测试库，覆盖伤病 CRUD、修改历史追踪、附件元信息与状态联动
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  createInjury,
  updateInjury,
  getInjuryById,
  deleteInjury,
  listInjuries,
  setInjuryAttachment,
  createRecoveryPlan,
  getRecoveryPlanByInjury,
  createHealthMetric,
  listHealthMetrics,
} from '@/lib/modules/health/HealthService';

let operatorId = 0;
let athleteId = 0;

const validInput = {
  athleteId: 0,
  injuryType: '韧带拉伤',
  description: '右膝前交叉韧带拉伤',
  bodyPart: '右膝',
  cause: '训练强度过大',
  diagnosis: '前交叉韧带轻度撕裂',
  treatment: '休息制动、康复训练计划',
  startDate: '2026-08-01T00:00:00.000Z',
  status: 'INJURED',
};

beforeAll(async () => {
  // 清理上次失败运行可能遗留的数据，确保可重复执行
  await prisma.injuryHistory.deleteMany();
  await prisma.recoveryPlan.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.user.deleteMany({ where: { username: 'injury_tester' } });

  const user = await prisma.user.create({
    data: { username: 'injury_tester', passwordHash: 'x', name: '测试教练', role: 'COACH' },
  });
  operatorId = user.id;
});

beforeEach(async () => {
  // 清理数据（按外键依赖顺序）
  await prisma.injuryHistory.deleteMany();
  await prisma.recoveryPlan.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.athlete.deleteMany();

  const athlete = await prisma.athlete.create({
    data: {
      name: '测试运动员',
      gender: '男',
      birthDate: new Date('2000-01-01'),
      sport: '篮球',
      joinDate: new Date('2024-01-01'),
    },
  });
  athleteId = athlete.id;
  validInput.athleteId = athlete.id;
});

afterAll(async () => {
  await prisma.injuryHistory.deleteMany();
  await prisma.recoveryPlan.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.user.deleteMany({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('createInjury 新增伤病记录', () => {
  it('应成功创建并落库所有必填字段', async () => {
    const injury = await createInjury(validInput, operatorId);

    expect(injury.id).toBeGreaterThan(0);
    expect(injury.bodyPart).toBe('右膝');
    expect(injury.cause).toBe('训练强度过大');
    expect(injury.diagnosis).toBe('前交叉韧带轻度撕裂');
    expect(injury.treatment).toBe('休息制动、康复训练计划');
    expect(injury.status).toBe('INJURED');
    expect(injury.athlete.name).toBe('测试运动员');
  });

  it('运动员不存在时应抛出业务错误', async () => {
    const bad = { ...validInput, athleteId: 99999 };
    await expect(createInjury(bad, operatorId)).rejects.toThrow('运动员不存在');
  });
});

describe('getInjuryById 查询伤病详情', () => {
  it('应返回包含修改历史的详情', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { diagnosis: '前交叉韧带II度撕裂' }, operatorId);

    const detail = await getInjuryById(injury.id);
    expect(detail).not.toBeNull();
    expect(detail!.history).toHaveLength(1);
    expect(detail!.history[0].operator.name).toBe('测试教练');
  });

  it('不存在的记录应返回 null', async () => {
    const detail = await getInjuryById(99999);
    expect(detail).toBeNull();
  });
});

describe('updateInjury 编辑伤病记录（变更历史追踪）', () => {
  it('修改字段应写入 InjuryHistory 且变更内容准确', async () => {
    const injury = await createInjury(validInput, operatorId);

    const updated = await updateInjury(
      injury.id,
      { diagnosis: '前交叉韧带II度撕裂', treatment: '手术治疗 + 康复训练', note: '复查后更新' },
      operatorId
    );

    expect(updated.diagnosis).toBe('前交叉韧带II度撕裂');
    expect(updated.treatment).toBe('手术治疗 + 康复训练');

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(1);
    const changes = JSON.parse(history[0].changes);
    expect(changes.diagnosis).toEqual({ before: '前交叉韧带轻度撕裂', after: '前交叉韧带II度撕裂' });
    expect(changes.treatment).toEqual({ before: '休息制动、康复训练计划', after: '手术治疗 + 康复训练' });
    expect(history[0].note).toBe('复查后更新');
  });

  it('无实际变更时不应写入历史记录', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { diagnosis: '前交叉韧带轻度撕裂' }, operatorId);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(0);
  });

  it('空白字符串字段应归一化为 null 并记录变更', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { cause: '   ' }, operatorId);

    const detail = await getInjuryById(injury.id);
    expect(detail!.cause).toBeNull();
    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(1);
    const changes = JSON.parse(history[0].changes);
    expect(changes.cause).toEqual({ before: '训练强度过大', after: null });
  });

  it('更新不存在的记录应抛出业务错误', async () => {
    await expect(updateInjury(99999, { diagnosis: 'x' }, operatorId)).rejects.toThrow('伤病记录不存在');
  });

  it('更新 athleteId 指向不存在的运动员应抛出业务错误', async () => {
    const injury = await createInjury(validInput, operatorId);
    await expect(updateInjury(injury.id, { athleteId: 99999 }, operatorId)).rejects.toThrow('运动员不存在');
  });

  it('修改受伤日期应记录 startDate 变更', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { startDate: '2026-08-03T00:00:00.000Z' }, operatorId);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(1);
    const changes = JSON.parse(history[0].changes);
    expect(changes.startDate).toEqual({
      before: '2026-08-01T00:00:00.000Z',
      after: '2026-08-03T00:00:00.000Z',
    });
  });

  it('同日不同 UTC 时刻不应产生日期噪音变更', async () => {
    // 前端在 UTC+8 时区会发送 15:00/16:00Z 的时刻，但日历日相同则不应记为变更
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { startDate: '2026-08-01T16:00:00.000Z' }, operatorId);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(0);
  });

  it('同日不同 UTC 时刻不应产生 endDate 噪音变更', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { endDate: '2026-09-01T00:00:00.000Z' }, operatorId);
    await updateInjury(injury.id, { endDate: '2026-09-01T16:00:00.000Z' }, operatorId);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(1); // 第一次设置为真实变更，第二次同日不产生
  });

  it('设置痊愈日期应记录 endDate 变更', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { endDate: '2026-09-01T00:00:00.000Z' }, operatorId);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    const changes = JSON.parse(history[0].changes);
    expect(changes.endDate).toEqual({ before: null, after: '2026-09-01T00:00:00.000Z' });
  });

  it('清除痊愈日期应记录 endDate 置空变更', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { endDate: '2026-09-01T00:00:00.000Z' }, operatorId);
    await updateInjury(injury.id, { endDate: null }, operatorId);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    const changes = JSON.parse(history[1].changes);
    expect(changes.endDate).toEqual({ before: '2026-09-01T00:00:00.000Z', after: null });
  });

  it('变更受伤运动员应成功并记录历史', async () => {
    const other = await prisma.athlete.create({
      data: {
        name: '另一运动员',
        gender: '女',
        birthDate: new Date('2001-01-01'),
        sport: '田径',
        joinDate: new Date('2024-06-01'),
      },
    });
    const injury = await createInjury(validInput, operatorId);

    const updated = await updateInjury(injury.id, { athleteId: other.id }, operatorId);
    expect(updated.athleteId).toBe(other.id);

    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    const changes = JSON.parse(history[0].changes);
    expect(changes.athleteId).toEqual({ before: athleteId, after: other.id });
  });
});

describe('deleteInjury 删除伤病记录', () => {
  it('应删除记录并级联删除修改历史', async () => {
    const injury = await createInjury(validInput, operatorId);
    await updateInjury(injury.id, { diagnosis: 'II度撕裂' }, operatorId);

    const result = await deleteInjury(injury.id, operatorId);
    expect(result.success).toBe(true);

    const deleted = await prisma.injury.findUnique({ where: { id: injury.id } });
    expect(deleted).toBeNull();
    const history = await prisma.injuryHistory.findMany({ where: { injuryId: injury.id } });
    expect(history).toHaveLength(0);
  });

  it('删除不存在的记录应抛出业务错误', async () => {
    await expect(deleteInjury(99999, operatorId)).rejects.toThrow('伤病记录不存在');
  });

  it('删除时应清理附件文件', async () => {
    // 构造一个真实附件文件
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.join(process.cwd(), 'public', 'uploads', 'injuries');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `injury-test-${Date.now()}.png`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const injury = await createInjury(validInput, operatorId);
    await setInjuryAttachment(injury.id, {
      path: `/uploads/injuries/${filename}`,
      name: '诊断报告.png',
      type: 'image/png',
      size: 4,
    });

    await deleteInjury(injury.id, operatorId);
    expect(fs.existsSync(path.join(dir, filename))).toBe(false);
  });
});

describe('setInjuryAttachment 附件元信息', () => {
  it('应更新附件字段', async () => {
    const injury = await createInjury(validInput, operatorId);
    const updated = await setInjuryAttachment(injury.id, {
      path: '/uploads/injuries/injury-1-123.png',
      name: 'MRI 影像.png',
      type: 'image/png',
      size: 2048,
    });

    expect(updated.attachmentPath).toBe('/uploads/injuries/injury-1-123.png');
    expect(updated.attachmentName).toBe('MRI 影像.png');
    expect(updated.attachmentType).toBe('image/png');
    expect(updated.attachmentSize).toBe(2048);
  });

  it('伤病记录不存在时应抛出业务错误', async () => {
    await expect(
      setInjuryAttachment(99999, { path: '/x', name: 'x', type: 'image/png', size: 1 })
    ).rejects.toThrow('伤病记录不存在');
  });
});

describe('listInjuries 分页查询', () => {
  it('应返回分页结果并包含运动员信息', async () => {
    await createInjury(validInput, operatorId);
    await createInjury({ ...validInput, injuryType: '肌肉拉伤', startDate: '2026-08-05T00:00:00.000Z' }, operatorId);

    const result = await listInjuries({ page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.injuries).toHaveLength(2);
    expect(result.injuries[0].athlete.name).toBe('测试运动员');
  });

  it('应按状态筛选', async () => {
    await createInjury(validInput, operatorId);
    await createInjury({ ...validInput, injuryType: '肌肉拉伤', status: 'RETURNED' }, operatorId);

    const result = await listInjuries({ status: 'RETURNED' });
    expect(result.total).toBe(1);
    expect(result.injuries[0].injuryType).toBe('肌肉拉伤');
  });

  it('应按运动员筛选', async () => {
    await createInjury(validInput, operatorId);
    const result = await listInjuries({ athleteId });
    expect(result.total).toBe(1);
    expect(result.injuries[0].athleteId).toBe(athleteId);
  });

  it('应按开始日期倒序排列', async () => {
    await createInjury(validInput, operatorId); // 2026-08-01
    await createInjury({ ...validInput, injuryType: '肌肉拉伤', startDate: '2026-08-10T00:00:00.000Z' }, operatorId);

    const result = await listInjuries({});
    expect(result.injuries[0].injuryType).toBe('肌肉拉伤'); // 较新的在前
  });
});

// ============================================================
// 康复计划（同属伤病与负荷监控模块）
// ============================================================
describe('createRecoveryPlan 康复计划', () => {
  it('应成功创建康复计划', async () => {
    const injury = await createInjury(validInput, operatorId);
    const plan = await createRecoveryPlan({
      injuryId: injury.id,
      content: '每日理疗 + 渐进式力量训练',
      startDate: '2026-08-05T00:00:00.000Z',
      targetReturnDate: '2026-10-01T00:00:00.000Z',
    });

    expect(plan.id).toBeGreaterThan(0);
    expect(plan.content).toContain('理疗');
    expect(plan.status).toBe('IN_PROGRESS');
  });

  it('同一伤病重复创建应抛出业务错误', async () => {
    const injury = await createInjury(validInput, operatorId);
    await createRecoveryPlan({
      injuryId: injury.id,
      content: '方案A',
      startDate: '2026-08-05T00:00:00.000Z',
      targetReturnDate: '2026-10-01T00:00:00.000Z',
    });
    await expect(
      createRecoveryPlan({
        injuryId: injury.id,
        content: '方案B',
        startDate: '2026-08-05T00:00:00.000Z',
        targetReturnDate: '2026-10-01T00:00:00.000Z',
      })
    ).rejects.toThrow('该伤病已有康复计划');
  });

  it('伤病不存在时应抛出业务错误', async () => {
    await expect(
      createRecoveryPlan({
        injuryId: 99999,
        content: '方案A',
        startDate: '2026-08-05T00:00:00.000Z',
        targetReturnDate: '2026-10-01T00:00:00.000Z',
      })
    ).rejects.toThrow('伤病记录不存在');
  });
});

describe('getRecoveryPlanByInjury 查询康复计划', () => {
  it('应返回关联的康复计划', async () => {
    const injury = await createInjury(validInput, operatorId);
    await createRecoveryPlan({
      injuryId: injury.id,
      content: '康复方案',
      startDate: '2026-08-05T00:00:00.000Z',
      targetReturnDate: '2026-10-01T00:00:00.000Z',
    });

    const plan = await getRecoveryPlanByInjury(injury.id);
    expect(plan?.content).toBe('康复方案');
  });

  it('无康复计划时应返回 null', async () => {
    const injury = await createInjury(validInput, operatorId);
    const plan = await getRecoveryPlanByInjury(injury.id);
    expect(plan).toBeNull();
  });
});

// ============================================================
// 健康指标（同属伤病与负荷监控模块）
// ============================================================
describe('createHealthMetric 健康指标', () => {
  it('应成功创建健康指标记录', async () => {
    const metric = await createHealthMetric(
      {
        athleteId,
        metricType: 'HEART_RATE',
        value: 72,
        unit: 'bpm',
        recordedAt: '2026-08-05T08:00:00.000Z',
      },
      operatorId
    );

    expect(metric.id).toBeGreaterThan(0);
    expect(metric.value).toBe(72);
    expect(metric.source).toBe('MANUAL');
    expect(metric.recordedById).toBe(operatorId);
  });

  it('运动员不存在时应抛出业务错误', async () => {
    await expect(
      createHealthMetric(
        {
          athleteId: 99999,
          metricType: 'RPE',
          value: 7,
          unit: '分',
          recordedAt: '2026-08-05T08:00:00.000Z',
        },
        operatorId
      )
    ).rejects.toThrow('运动员不存在');
  });
});

describe('listHealthMetrics 查询健康指标', () => {
  it('应按运动员与指标类型筛选并分页', async () => {
    await createHealthMetric(
      { athleteId, metricType: 'HEART_RATE', value: 70, unit: 'bpm', recordedAt: '2026-08-01T08:00:00.000Z' },
      operatorId
    );
    await createHealthMetric(
      { athleteId, metricType: 'HEART_RATE', value: 75, unit: 'bpm', recordedAt: '2026-08-02T08:00:00.000Z' },
      operatorId
    );
    await createHealthMetric(
      { athleteId, metricType: 'SLEEP', value: 8, unit: '小时', recordedAt: '2026-08-01T08:00:00.000Z' },
      operatorId
    );

    const result = await listHealthMetrics({ athleteId, metricType: 'HEART_RATE', page: 1, pageSize: 1 });
    expect(result.total).toBe(2);
    expect(result.metrics).toHaveLength(1);
    expect(result.totalPages).toBe(2);
  });

  it('应按日期范围筛选并按时间倒序', async () => {
    await createHealthMetric(
      { athleteId, metricType: 'RPE', value: 6, unit: '分', recordedAt: '2026-08-01T08:00:00.000Z' },
      operatorId
    );
    await createHealthMetric(
      { athleteId, metricType: 'RPE', value: 9, unit: '分', recordedAt: '2026-08-10T08:00:00.000Z' },
      operatorId
    );

    const result = await listHealthMetrics({
      athleteId,
      startDate: '2026-08-05T00:00:00.000Z',
      endDate: '2026-08-15T00:00:00.000Z',
    });
    expect(result.total).toBe(1);
    expect(result.metrics[0].value).toBe(9);
  });
});
