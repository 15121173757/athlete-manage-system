/**
 * 运动能力综合测试演示数据种子脚本 —— 运动员管理系统（AMS）
 *
 * 用法：node scripts/seed-ability-demo.cjs
 *
 * 场景：4 名篮球运动员（林晓峰 / 张伟 / 王浩 / 李健）的全面运动能力评估与对比。
 * 覆盖 8 个素质维度（最大力量 / 爆发力 / 有氧耐力 / 无氧耐力 /
 * 速度（反应 + 移动）/ 敏捷性 / 柔韧性 / 技术技能），共 17 项测试，
 * 每项测试挂 3~4 套科学虚构常模：
 *   - 青年男性通用常模（同年龄、同性别的普通人参考值）
 *   - 青年女性通用常模（性别对照）
 *   - 篮球运动员常模（专项参考值；技术技能测试含后卫/前锋位置细分）
 *
 * 运动员画像（差异化，便于多人对比验证）：
 *   - 林晓峰：发展中的后卫，无氧/爆发较好，柔韧/敏捷偏弱
 *   - 张伟：全面优秀（高 TSA 对照组）
 *   - 王浩：待提升（耐力、柔韧短板）
 *   - 李健：速度敏捷型，力量偏弱
 *
 * 幂等策略（可重复运行）：
 * - 运动员按姓名 upsert（存在即更新档案）
 * - 测试按名称 upsert（存在即更新 分类/方向/单位/常模）
 * - 计划按名称 upsert（存在即重建测试项与参与者）
 * - 成绩按 计划×运动员×项目 唯一键 upsert
 *
 * 运行结束后会打印：数据落库核对 + 4 名运动员的
 * Z 分数 / T 分 / 维度得分 / TSA 对比报告（与系统计算口径一致）。
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============================================================
// 计算口径（与 lib/modules/fitness/abilityAnalysis.ts 保持一致）
// ============================================================
function round1(v) {
  return Math.round(v * 10) / 10;
}
function computeZ(value, mean, stdDev, direction) {
  if (!Number.isFinite(value) || !Number.isFinite(mean) || !Number.isFinite(stdDev) || stdDev <= 0) return null;
  const z = (value - mean) / stdDev;
  return direction === 'LOWER_BETTER' ? -z : z;
}
// 标准正态累积分布函数 Φ(z)（erf 近似，与 lib/modules/fitness/abilityAnalysis.ts 同口径）
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-ax * ax);
  return sign * y;
}
function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
// 百分等级 = Φ(Z) × 100（保留一位小数）；与系统口径一致：基于显示 Z 分数
function percentileFromZ(z) {
  return round1(normalCdf(z) * 100);
}
function tScoreFromZ(z) {
  return Math.min(100, Math.max(0, round1(50 + 10 * z)));
}
function tsaLevel(tsa) {
  return tsa >= 85 ? '优秀' : tsa >= 70 ? '良好' : tsa >= 60 ? '及格' : '待提升';
}

// ============================================================
// 演示数据定义
// ============================================================

// 4 名运动员档案与 17 项测试成绩（scores 键 = 测试名称）
const ATHLETES = [
  {
    name: '林晓峰',
    gender: 'MALE',
    birthDate: new Date('2004-01-15'), // 22 岁
    height: 188,
    weight: 82,
    sport: '篮球',
    position: '控球后卫',
    joinDate: new Date('2023-09-01'),
    scores: {
      '1RM深蹲': 118, '1RM卧推': 82, '立定跳远': 2.56, '原地纵跳': 68,
      '库珀12分钟跑': 2650, '3000米跑': 708, '温盖特30秒功率': 720, '400米跑': 66,
      '30米冲刺': 4.2, '50米跑': 6.9, '视觉反应时': 0.22,
      '伊利诺斯敏捷测试': 15.8, 'T形敏捷测试': 10.2, '坐位体前屈': 14,
      '运球绕桩计时': 16.5, '定点投篮命中率': 55, '传球准确性': 9,
    },
  },
  {
    name: '张伟',
    gender: 'MALE',
    birthDate: new Date('2003-05-20'), // 23 岁
    height: 194,
    weight: 90,
    sport: '篮球',
    position: '小前锋',
    joinDate: new Date('2022-07-01'),
    scores: {
      '1RM深蹲': 135, '1RM卧推': 95, '立定跳远': 2.75, '原地纵跳': 72,
      '库珀12分钟跑': 3100, '3000米跑': 660, '温盖特30秒功率': 800, '400米跑': 62,
      '30米冲刺': 4.0, '50米跑': 6.6, '视觉反应时': 0.2,
      '伊利诺斯敏捷测试': 14.9, 'T形敏捷测试': 9.6, '坐位体前屈': 18,
      '运球绕桩计时': 15.2, '定点投篮命中率': 62, '传球准确性': 10,
    },
  },
  {
    name: '王浩',
    gender: 'MALE',
    birthDate: new Date('2005-11-03'), // 20 岁
    height: 201,
    weight: 95,
    sport: '篮球',
    position: '中锋',
    joinDate: new Date('2024-02-01'),
    scores: {
      '1RM深蹲': 95, '1RM卧推': 70, '立定跳远': 2.3, '原地纵跳': 52,
      '库珀12分钟跑': 2100, '3000米跑': 810, '温盖特30秒功率': 540, '400米跑': 82,
      '30米冲刺': 4.6, '50米跑': 7.5, '视觉反应时': 0.28,
      '伊利诺斯敏捷测试': 17.2, 'T形敏捷测试': 11.3, '坐位体前屈': 8,
      '运球绕桩计时': 20.5, '定点投篮命中率': 38, '传球准确性': 7,
    },
  },
  {
    name: '李健',
    gender: 'MALE',
    birthDate: new Date('2002-09-12'), // 23 岁
    height: 185,
    weight: 78,
    sport: '篮球',
    position: '得分后卫',
    joinDate: new Date('2021-06-01'),
    scores: {
      '1RM深蹲': 88, '1RM卧推': 66, '立定跳远': 2.62, '原地纵跳': 66,
      '库珀12分钟跑': 2700, '3000米跑': 690, '温盖特30秒功率': 660, '400米跑': 68,
      '30米冲刺': 4.0, '50米跑': 6.5, '视觉反应时': 0.2,
      '伊利诺斯敏捷测试': 15.0, 'T形敏捷测试': 9.5, '坐位体前屈': 16,
      '运球绕桩计时': 16.0, '定点投篮命中率': 48, '传球准确性': 8,
    },
  },
];

const PLAN = {
  name: '篮球运动员运动能力综合测试（演示）',
  testDate: new Date('2026-08-10T09:00:00+08:00'), // 过去时间 → 自动为「已执行」
  startTime: '09:00',
  estimatedDuration: 150,
  location: '综合体能训练馆',
  weather: '晴',
  venueCondition: '良好',
  notes: '演示场景：覆盖力量/爆发力/耐力/速度/敏捷/柔韧/技术技能 8 维度的全面运动能力评估（4 人对比）',
};

// 常模命名规约：{normName, mean, stdDev}
// 每个测试：青年男性通用 / 青年女性通用 / 篮球专项（技术技能测试含位置细分）
const TESTS = [
  // ---- 力量测试（最大力量） ----
  {
    name: '1RM深蹲', category: '力量测试', unit: 'kg', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 100, stdDev: 15 },
      { normName: '青年女性通用常模', mean: 70, stdDev: 12 },
      { normName: '篮球运动员常模', mean: 95, stdDev: 12 },
      { normName: '精英力量常模', mean: 130, stdDev: 10 },
      { normName: '青少年常模', mean: 85, stdDev: 18 },
    ],
  },
  {
    name: '1RM卧推', category: '力量测试', unit: 'kg', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 75, stdDev: 12 },
      { normName: '青年女性通用常模', mean: 45, stdDev: 10 },
      { normName: '篮球运动员常模', mean: 70, stdDev: 10 },
      { normName: '精英力量常模', mean: 100, stdDev: 8 },
    ],
  },
  // ---- 爆发力测试 ----
  {
    name: '立定跳远', category: '爆发力测试', unit: 'm', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 2.45, stdDev: 0.15 },
      { normName: '青年女性通用常模', mean: 1.95, stdDev: 0.12 },
      { normName: '篮球运动员常模', mean: 2.6, stdDev: 0.12 },
    ],
  },
  {
    name: '原地纵跳', category: '爆发力测试', unit: 'cm', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 55, stdDev: 8 },
      { normName: '青年女性通用常模', mean: 38, stdDev: 6 },
      { normName: '篮球运动员常模', mean: 65, stdDev: 8 },
    ],
  },
  // ---- 有氧耐力测试 ----
  {
    name: '库珀12分钟跑', category: '有氧耐力测试', unit: 'm', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 2400, stdDev: 300 },
      { normName: '青年女性通用常模', mean: 2000, stdDev: 250 },
      { normName: '篮球运动员常模', mean: 2800, stdDev: 250 },
      { normName: '精英耐力常模', mean: 3200, stdDev: 200 },
    ],
  },
  {
    name: '3000米跑', category: '有氧耐力测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 750, stdDev: 30 },
      { normName: '青年女性通用常模', mean: 850, stdDev: 35 },
      { normName: '篮球运动员常模', mean: 700, stdDev: 25 },
      { normName: '精英耐力常模', mean: 640, stdDev: 20 },
    ],
  },
  // ---- 无氧耐力测试 ----
  {
    name: '温盖特30秒功率', category: '无氧耐力测试', unit: 'W', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 600, stdDev: 80 },
      { normName: '青年女性通用常模', mean: 420, stdDev: 60 },
      { normName: '篮球运动员常模', mean: 650, stdDev: 70 },
    ],
  },
  {
    name: '400米跑', category: '无氧耐力测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 75, stdDev: 6 },
      { normName: '青年女性通用常模', mean: 88, stdDev: 7 },
      { normName: '篮球运动员常模', mean: 70, stdDev: 5 },
    ],
  },
  // ---- 速度测试（反应速度 + 移动速度） ----
  {
    name: '30米冲刺', category: '速度测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 4.5, stdDev: 0.3 },
      { normName: '青年女性通用常模', mean: 5.2, stdDev: 0.35 },
      { normName: '篮球运动员常模', mean: 4.3, stdDev: 0.25 },
      { normName: '精英速度常模', mean: 4.1, stdDev: 0.15 },
    ],
  },
  {
    name: '50米跑', category: '速度测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 7.2, stdDev: 0.4 },
      { normName: '青年女性通用常模', mean: 8.2, stdDev: 0.45 },
      { normName: '篮球运动员常模', mean: 7.0, stdDev: 0.35 },
    ],
  },
  {
    name: '视觉反应时', category: '速度测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 0.25, stdDev: 0.03 },
      { normName: '青年女性通用常模', mean: 0.27, stdDev: 0.03 },
      { normName: '篮球运动员常模', mean: 0.23, stdDev: 0.025 },
      { normName: '精英反应常模', mean: 0.2, stdDev: 0.02 },
    ],
  },
  // ---- 敏捷测试 ----
  {
    name: '伊利诺斯敏捷测试', category: '敏捷测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 16.5, stdDev: 1.0 },
      { normName: '青年女性通用常模', mean: 18.5, stdDev: 1.2 },
      { normName: '篮球运动员常模', mean: 15.5, stdDev: 0.8 },
    ],
  },
  {
    name: 'T形敏捷测试', category: '敏捷测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 10.5, stdDev: 0.8 },
      { normName: '青年女性通用常模', mean: 11.8, stdDev: 1.0 },
      { normName: '篮球运动员常模', mean: 9.8, stdDev: 0.7 },
    ],
  },
  // ---- 灵活性测试 ----
  {
    name: '坐位体前屈', category: '灵活性测试', unit: 'cm', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '青年男性通用常模', mean: 15, stdDev: 6 },
      { normName: '青年女性通用常模', mean: 22, stdDev: 6 },
      { normName: '篮球运动员常模', mean: 12, stdDev: 5 },
      { normName: '青少年常模', mean: 10, stdDev: 5 },
    ],
  },
  // ---- 技术技能测试（篮球专项） ----
  {
    name: '运球绕桩计时', category: '技术技能测试', unit: 's', direction: 'LOWER_BETTER',
    norms: [
      { normName: '篮球后卫常模', mean: 18, stdDev: 2 },
      { normName: '篮球前锋常模', mean: 20, stdDev: 2 },
      { normName: '青年男性通用常模', mean: 21, stdDev: 3 },
      { normName: '青年女性通用常模', mean: 24, stdDev: 3 },
    ],
  },
  {
    name: '定点投篮命中率', category: '技术技能测试', unit: '%', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '篮球后卫常模', mean: 45, stdDev: 10 },
      { normName: '篮球前锋常模', mean: 48, stdDev: 10 },
      { normName: '青年男性通用常模', mean: 40, stdDev: 12 },
      { normName: '精英投篮常模', mean: 55, stdDev: 8 },
    ],
  },
  {
    name: '传球准确性', category: '技术技能测试', unit: '次', direction: 'HIGHER_BETTER',
    norms: [
      { normName: '篮球后卫常模', mean: 8, stdDev: 1.5 },
      { normName: '篮球前锋常模', mean: 7, stdDev: 1.5 },
      { normName: '青年男性通用常模', mean: 7, stdDev: 2 },
    ],
  },
];

// 维度改进建议（按得分区间）
const ADVICE = {
  '力量测试': '增加最大力量训练，建议 6-8 周线性周期（如 5×5 深蹲/卧推），保持动作质量与每周渐进超负荷。',
  '爆发力测试': '加强跳跃与爆发力训练（跳深、药球抛掷、负重跳），配合抗阻速度训练改善发力率（RFD）。',
  '有氧耐力测试': '增加每周 2-3 次有氧耐力训练（长距离慢跑、法特莱克、游泳），逐步提升最大摄氧量。',
  '无氧耐力测试': '强化高强度间歇训练（200m 间歇跑、短冲刺重复组），提升乳酸耐受与再合成能力。',
  '速度测试': '强化短距离冲刺与反应训练（10-30m 加速跑、反应球、起跑反应练习）。',
  '敏捷测试': '增加敏捷性训练（绳梯步法、变向折返、T 形跑），改善制动、变向与再加速能力。',
  '灵活性测试': '制定每日柔韧性计划（动态热身 + 静态拉伸），重点关注髋、肩、腘绳肌群活动度。',
  '技术技能测试': '结合专项进行技能强化（运球、投篮、传球的分解训练与对抗情景结合）。',
};

// 计算某名运动员各维度得分（基于各测试第 1 套常模；百分位口径与系统一致）
function computeAthleteReport(athlete) {
  const dimMap = new Map();
  for (const t of TESTS) {
    const norm = t.norms[0];
    const value = athlete.scores[t.name];
    const z = computeZ(value, norm.mean, norm.stdDev, t.direction);
    const zR = round1(z);
    const tScore = tScoreFromZ(z);
    const row = { name: t.name, value, unit: t.unit, normName: norm.normName, z: zR, p: percentileFromZ(zR), t: tScore };
    if (!dimMap.has(t.category)) dimMap.set(t.category, []);
    dimMap.get(t.category).push(row);
  }
  const dims = [...dimMap.entries()].map(([category, rows]) => {
    const avgZ = rows.reduce((s, r) => s + r.z, 0) / rows.length;
    return {
      category,
      score: round1(rows.reduce((s, r) => s + r.t, 0) / rows.length),
      percentile: percentileFromZ(avgZ),
      rows,
    };
  });
  const tsa = round1(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  return {
    name: athlete.name,
    sport: athlete.sport,
    position: athlete.position,
    dims,
    tsa,
    tsaPercentile: percentileFromZ((tsa - 50) / 10),
  };
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log('==== 运动能力综合测试演示数据入库（4 人对比） ====\n');

  // ---- 0. 操作人 ----
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) throw new Error('未找到管理员账户，请先运行 scripts/seed-mock.cjs');

  // ---- 1. 运动员（按姓名 upsert） ----
  const finalAthletes = [];
  for (const a of ATHLETES) {
    const { scores, ...profile } = a;
    const existing = await prisma.athlete.findFirst({ where: { name: a.name } });
    const saved = existing
      ? await prisma.athlete.update({ where: { id: existing.id }, data: profile })
      : await prisma.athlete.create({ data: profile });
    finalAthletes.push({ ...saved, scores });
    console.log(`[运动员] ${saved.name}（${saved.sport} · ${saved.position}） id=${saved.id}${existing ? ' [更新]' : ' [新建]'}`);
  }

  // ---- 2. 测试库（含常模） ----
  const testIdByName = new Map();
  for (const t of TESTS) {
    const data = {
      name: t.name,
      category: t.category,
      unit: t.unit,
      direction: t.direction,
      resultType: 'NUMERIC',
      standards: JSON.stringify(t.norms),
    };
    const existing = await prisma.fitnessTest.findUnique({ where: { name: t.name } });
    const saved = existing
      ? await prisma.fitnessTest.update({ where: { id: existing.id }, data })
      : await prisma.fitnessTest.create({ data });
    testIdByName.set(t.name, saved.id);
    console.log(
      `[测试] ${saved.id} ${saved.name}（${saved.category} · ${saved.unit} · ${saved.direction}）常模 ${t.norms.length} 套${existing ? ' [更新]' : ' [新建]'}`
    );
  }

  // ---- 3. 测试计划（已执行，参与者 4 人） ----
  const existingPlan = await prisma.fitnessTestPlan.findFirst({ where: { name: PLAN.name } });
  let plan;
  if (existingPlan) {
    // 重建测试项与参与者，保证与本次测试清单一致
    await prisma.fitnessTestPlanItem.deleteMany({ where: { planId: existingPlan.id } });
    await prisma.fitnessTestPlanParticipant.deleteMany({ where: { planId: existingPlan.id } });
    plan = await prisma.fitnessTestPlan.update({
      where: { id: existingPlan.id },
      data: {
        testDate: PLAN.testDate,
        startTime: PLAN.startTime,
        estimatedDuration: PLAN.estimatedDuration,
        location: PLAN.location,
        weather: PLAN.weather,
        venueCondition: PLAN.venueCondition,
        notes: PLAN.notes,
        status: 'COMPLETED',
      },
    });
    console.log(`[计划] ${plan.name} id=${plan.id} [已存在，重建测试项]`);
  } else {
    plan = await prisma.fitnessTestPlan.create({
      data: {
        name: PLAN.name,
        testDate: PLAN.testDate,
        startTime: PLAN.startTime,
        estimatedDuration: PLAN.estimatedDuration,
        location: PLAN.location,
        weather: PLAN.weather,
        venueCondition: PLAN.venueCondition,
        notes: PLAN.notes,
        status: 'COMPLETED',
        createdById: admin.id,
      },
    });
    console.log(`[计划] ${plan.name} id=${plan.id} [新建]`);
  }

  await prisma.fitnessTestPlanItem.createMany({
    data: TESTS.map((t, i) => ({
      planId: plan.id,
      testId: testIdByName.get(t.name),
      sortOrder: i,
      groupName: t.category,
      allocatedMinutes: 8,
    })),
  });
  await prisma.fitnessTestPlanParticipant.createMany({
    data: finalAthletes.map((a) => ({ planId: plan.id, athleteId: a.id })),
  });
  const itemCount = await prisma.fitnessTestPlanItem.count({ where: { planId: plan.id } });
  const participantCount = await prisma.fitnessTestPlanParticipant.count({ where: { planId: plan.id } });
  console.log(`[计划] 测试项 ${itemCount} 项，参与者 ${participantCount} 名，状态=${plan.status}`);

  // ---- 4. 成绩录入（按 计划×运动员×项目 upsert，4×17=68 条） ----
  let resultCount = 0;
  for (const a of finalAthletes) {
    for (const t of TESTS) {
      const testId = testIdByName.get(t.name);
      const value = a.scores[t.name];
      const raw = String(value);
      await prisma.fitnessTestResult.upsert({
        where: { planId_athleteId_testId: { planId: plan.id, athleteId: a.id, testId } },
        create: { planId: plan.id, athleteId: a.id, testId, rawValue: raw, value, recordedById: admin.id },
        update: { rawValue: raw, value, recordedById: admin.id },
      });
      resultCount += 1;
    }
  }
  console.log(`[成绩] 已录入 ${resultCount} 条\n`);

  // ============================================================
  // 综合分析报告（4 人对比，与系统计算口径一致）
  // ============================================================
  const reports = finalAthletes.map(computeAthleteReport);

  console.log('============================================================');
  console.log('       运动能力综合分析报告（4 人对比 · 演示数据）');
  console.log('============================================================');
  console.log('常模口径：各测试默认选用第 1 套常模（技术技能测试为篮球后卫常模，其余为青年男性通用常模）\n');

  // 逐人明细（含百分位）
  for (const r of reports) {
    console.log(
      `■ ${r.name}（${r.sport} · ${r.position}） TSA=${r.tsa}（${tsaLevel(r.tsa)}）百分等级=${r.tsaPercentile}%`
    );
    for (const d of r.dims) {
      const detail = d.rows.map((x) => `${x.name} ${x.value}${x.unit} → Z=${x.z}, P=${x.p}%, T=${x.t}`).join('；');
      console.log(`  【${d.category}】${d.score} 分 · 百分等级 ${d.percentile}%`);
      console.log(`      ${detail}`);
    }
    console.log('');
  }

  // 对比表
  console.log('━━━ 维度得分对比 ━━━');
  const header = `维度`.padEnd(10) + reports.map((r) => r.name.padEnd(10)).join('');
  console.log(header);
  const catOrder = reports[0].dims.map((d) => d.category);
  for (const cat of catOrder) {
    const scores = reports.map((r) => {
      const d = r.dims.find((x) => x.category === cat);
      return String(d ? d.score : '—').padEnd(10);
    });
    console.log(cat.padEnd(10) + scores.join(''));
  }
  const tsaRow = reports.map((r) => `${r.tsa}（${r.tsaPercentile}%）`.padEnd(10));
  console.log('TSA'.padEnd(10) + tsaRow.join(''));

  // 百分位对照验证：标准正态关键 Z 值（预期百分位为统计表精确值）
  console.log('\n━━━ 百分等级计算校验（标准正态关键 Z 值） ━━━');
  const Z_REF = [
    { z: -3, expect: 0.1 }, { z: -2.33, expect: 1.0 }, { z: -2, expect: 2.3 },
    { z: -1.645, expect: 5.0 }, { z: -1, expect: 15.9 }, { z: -0.5, expect: 30.9 },
    { z: 0, expect: 50 }, { z: 0.5, expect: 69.1 }, { z: 1, expect: 84.1 },
    { z: 1.28, expect: 90.0 }, { z: 1.645, expect: 95.0 }, { z: 2, expect: 97.7 },
    { z: 2.33, expect: 99.0 }, { z: 3, expect: 99.9 },
  ];
  let allMatch = true;
  for (const { z, expect } of Z_REF) {
    const got = percentileFromZ(z);
    const ok = got === expect;
    if (!ok) allMatch = false;
    console.log(`  Z=${String(z).padEnd(6)} → P=${got}% （预期 ${expect}%）${ok ? '✓' : '✗ 不符'}`);
  }
  console.log(allMatch ? '  → 全部关键点与统计表一致 ✓' : '  → 存在偏差，请核查 erf 近似！');

  // 常模切换验证：同一成绩换用不同常模，百分位应随之正确变化
  console.log('\n━━━ 不同常模切换验证（同一成绩，不同常模口径） ━━━');
  const switchCases = [
    { label: '张伟 1RM深蹲 135kg', dir: 'HIGHER_BETTER', value: 135, norms: [
      { normName: '青年男性通用常模', mean: 100, stdDev: 15 },
      { normName: '篮球运动员常模', mean: 95, stdDev: 12 },
      { normName: '精英力量常模', mean: 130, stdDev: 10 },
    ]},
    { label: '张伟 30米冲刺 4.0s', dir: 'LOWER_BETTER', value: 4.0, norms: [
      { normName: '青年男性通用常模', mean: 4.5, stdDev: 0.3 },
      { normName: '篮球运动员常模', mean: 4.3, stdDev: 0.25 },
      { normName: '精英速度常模', mean: 4.1, stdDev: 0.15 },
    ]},
    { label: '王浩 库珀12分钟跑 2100m', dir: 'HIGHER_BETTER', value: 2100, norms: [
      { normName: '青年男性通用常模', mean: 2400, stdDev: 300 },
      { normName: '篮球运动员常模', mean: 2800, stdDev: 250 },
      { normName: '精英耐力常模', mean: 3200, stdDev: 200 },
    ]},
  ];
  for (const c of switchCases) {
    console.log(`  ${c.label}（${c.dir === 'LOWER_BETTER' ? '越低越好' : '越高越好'}）：`);
    for (const n of c.norms) {
      const z = computeZ(c.value, n.mean, n.stdDev, c.dir);
      const zR = round1(z);
      console.log(`    ${n.normName.padEnd(10)} μ=${n.mean} σ=${n.stdDev} → Z=${zR}, P=${percentileFromZ(zR)}%`);
    }
  }

  console.log('\n━━━ 改进建议（按维度得分区间） ━━━');
  for (const r of reports) {
    console.log(`■ ${r.name}（TSA ${r.tsa}）`);
    const sorted = [...r.dims].sort((a, b) => a.score - b.score);
    for (const d of sorted.slice(0, 3)) {
      console.log(`  · ${d.category}（${d.score}）：${ADVICE[d.category] || '需针对性加强训练。'}`);
    }
  }

  console.log('\n==== 数据入库与报告完成 ====');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
