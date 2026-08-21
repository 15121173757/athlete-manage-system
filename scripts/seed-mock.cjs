/**
 * 模拟数据种子脚本 —— 运动员管理系统
 *
 * 用法：node scripts/seed-mock.cjs
 *
 * 创建：
 * - 1 个管理员账户
 * - 6 名运动员（不同风险等级）
 * - 伤病记录、训练记录（含高 RPE）
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('开始插入模拟数据...\n');

  // ---- 1. 创建管理员用户 ----
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      name: '系统管理员',
      role: 'ADMIN',
    },
  });
  console.log(`✓ 管理员账户: admin / admin123 (ID: ${admin.id})`);

  // ---- 2. 创建练习项目 ----
  const exercises = await Promise.all([
    prisma.exercise.upsert({
      where: { name: '深蹲' },
      update: {},
      create: { name: '深蹲', category: '力量', unit: 'kg', isPBTrackable: true },
    }),
    prisma.exercise.upsert({
      where: { name: '卧推' },
      update: {},
      create: { name: '卧推', category: '力量', unit: 'kg', isPBTrackable: true },
    }),
    prisma.exercise.upsert({
      where: { name: '硬拉' },
      update: {},
      create: { name: '硬拉', category: '力量', unit: 'kg', isPBTrackable: true },
    }),
    prisma.exercise.upsert({
      where: { name: '冲刺跑' },
      update: {},
      create: { name: '冲刺跑', category: '速度', unit: '秒', isPBTrackable: true },
    }),
    prisma.exercise.upsert({
      where: { name: '长跑' },
      update: {},
      create: { name: '长跑', category: '耐力', unit: '米', isPBTrackable: false },
    }),
  ]);
  console.log(`✓ 练习项目: ${exercises.length} 个`);

  // ---- 3. 创建运动员 ----
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const athletesData = [
    { name: '张伟', gender: 'MALE', sport: '田径', position: '短跑', birthDate: '2000-03-15', height: 182, weight: 75 },
    { name: '李娜', gender: 'FEMALE', sport: '游泳', position: '自由泳', birthDate: '2001-07-22', height: 170, weight: 60 },
    { name: '王强', gender: 'MALE', sport: '篮球', position: '后卫', birthDate: '1999-11-08', height: 195, weight: 85 },
    { name: '赵敏', gender: 'FEMALE', sport: '体操', position: '全能', birthDate: '2002-01-30', height: 160, weight: 48 },
    { name: '孙磊', gender: 'MALE', sport: '举重', position: '85kg级', birthDate: '1998-05-12', height: 175, weight: 85 },
    { name: '周婷', gender: 'FEMALE', sport: '排球', position: '主攻', birthDate: '2000-09-18', height: 188, weight: 72 },
  ];

  const athletes = [];
  for (const a of athletesData) {
    const athlete = await prisma.athlete.create({
      data: {
        name: a.name,
        gender: a.gender,
        birthDate: new Date(a.birthDate),
        height: a.height,
        weight: a.weight,
        sport: a.sport,
        position: a.position,
        joinDate: daysAgo(365),
      },
    });
    athletes.push(athlete);
    console.log(`✓ 运动员: ${athlete.name} (ID: ${athlete.id})`);
  }

  // ---- 4. 创建伤病记录 ----
  // 张伟 - 当前受伤 (INJURED) -> +30 分
  await prisma.injury.create({
    data: {
      athleteId: athletes[0].id,
      injuryType: '右膝韧带拉伤',
      description: '训练中右膝前交叉韧带部分拉伤，需休养 6-8 周',
      startDate: daysAgo(5),
      status: 'INJURED',
      recordedById: admin.id,
    },
  });
  console.log(`  ↳ 张伟: 右膝韧带拉伤 (INJURED)`);

  // 李娜 - 康复中 (RECOVERING) -> +15 分
  await prisma.injury.create({
    data: {
      athleteId: athletes[1].id,
      injuryType: '左肩旋转袖损伤',
      description: '左肩旋转袖肌腱炎，正在康复治疗中',
      startDate: daysAgo(20),
      status: 'RECOVERING',
      recordedById: admin.id,
    },
  });
  console.log(`  ↳ 李娜: 左肩旋转袖损伤 (RECOVERING)`);

  // 赵敏 - 康复中 (RECOVERING) -> +15 分
  await prisma.injury.create({
    data: {
      athleteId: athletes[3].id,
      injuryType: '右踝扭伤',
      description: '落地时右踝外侧韧带轻度扭伤',
      startDate: daysAgo(10),
      status: 'RECOVERING',
      recordedById: admin.id,
    },
  });
  console.log(`  ↳ 赵敏: 右踝扭伤 (RECOVERING)`);

  // ---- 5. 创建训练记录（近 7 天）----
  // 张伟 - 高 RPE 记录 (≥8) x3 -> +20 分，总风险 = 30+20 = 50 (高风险)
  for (let i = 0; i < 4; i++) {
    await prisma.trainingRecord.create({
      data: {
        athleteId: athletes[0].id,
        exerciseId: exercises[i % exercises.length].id,
        actualSets: 5,
        actualReps: 8,
        actualLoad: 120 + i * 10,
        trainingDate: daysAgo(i),
        rpe: 8 + (i % 2),
        notes: i === 0 ? '膝部不适' : '',
        recordedById: admin.id,
      },
    });
  }
  console.log(`  ↳ 张伟: 4 条训练记录 (RPE 8-9)`);

  // 王强 - 高 RPE 记录 x3 -> +20 分，无伤病，总风险 = 20 (中风险)
  for (let i = 0; i < 5; i++) {
    await prisma.trainingRecord.create({
      data: {
        athleteId: athletes[2].id,
        exerciseId: exercises[i % exercises.length].id,
        actualSets: 4,
        actualReps: 10,
        actualLoad: 100 + i * 5,
        trainingDate: daysAgo(i),
        rpe: i < 3 ? 8 + (i % 2) : 6,
        recordedById: admin.id,
      },
    });
  }
  console.log(`  ↳ 王强: 5 条训练记录 (3 条 RPE≥8)`);

  // 孙磊 - 高 RPE 记录 x1 -> +10 分，无伤病，总风险 = 10 (低风险)
  for (let i = 0; i < 3; i++) {
    await prisma.trainingRecord.create({
      data: {
        athleteId: athletes[4].id,
        exerciseId: exercises[i % exercises.length].id,
        actualSets: 3,
        actualReps: 5,
        actualLoad: 180 + i * 10,
        trainingDate: daysAgo(i),
        rpe: i === 0 ? 8 : 6,
        recordedById: admin.id,
      },
    });
  }
  console.log(`  ↳ 孙磊: 3 条训练记录 (1 条 RPE≥8)`);

  // 周婷 - 正常训练，无风险因素 -> 0 分 (低风险)
  for (let i = 0; i < 2; i++) {
    await prisma.trainingRecord.create({
      data: {
        athleteId: athletes[5].id,
        exerciseId: exercises[i].id,
        actualSets: 3,
        actualReps: 12,
        actualLoad: 60,
        trainingDate: daysAgo(i),
        rpe: 5,
        recordedById: admin.id,
      },
    });
  }
  console.log(`  ↳ 周婷: 2 条训练记录 (RPE 5)`);

  // 李娜 - 康复训练，低 RPE -> 总风险 = 15 (低风险)
  await prisma.trainingRecord.create({
    data: {
      athleteId: athletes[1].id,
      exerciseId: exercises[0].id,
      actualSets: 2,
      actualReps: 15,
      actualLoad: 40,
      trainingDate: daysAgo(1),
      rpe: 4,
      notes: '康复训练',
      recordedById: admin.id,
    },
  });
  console.log(`  ↳ 李娜: 1 条康复训练记录 (RPE 4)`);

  // 赵敏 - 少量训练 -> 总风险 = 15 (低风险)
  await prisma.trainingRecord.create({
    data: {
      athleteId: athletes[3].id,
      exerciseId: exercises[3].id,
      actualSets: 2,
      actualReps: 6,
      trainingDate: daysAgo(2),
      rpe: 5,
      notes: '轻度恢复训练',
      recordedById: admin.id,
    },
  });
  console.log(`  ↳ 赵敏: 1 条恢复训练记录 (RPE 5)`);

  console.log('\n========================================');
  console.log('模拟数据插入完成！');
  console.log('========================================');
  console.log('\n预期风险评分：');
  console.log('  张伟:  50 (高风险) - 受伤+30, 高RPE+20');
  console.log('  王强:  20 (中风险) - 高RPE+20');
  console.log('  李娜:  15 (低风险) - 康复中+15');
  console.log('  赵敏:  15 (低风险) - 康复中+15');
  console.log('  孙磊:  10 (低风险) - 高RPE+10');
  console.log('  周婷:   0 (低风险) - 无风险因素');
  console.log('\n登录账户: admin / admin123');
}

main()
  .catch((e) => {
    console.error('插入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
