/**
 * 批量生成运动员与历史训练计划 —— 运动员管理系统（AMS）
 *
 * 用法：node scripts/seed-athletes-plans.cjs
 *
 * 创建（在既有数据基础上追加）：
 * - 250 名信息各不相同的虚拟运动员
 * - 550 份「今日之前」的训练计划（COMPLETED，关联既有练习项与新运动员）
 *
 * 特性：
 * - 姓名唯一：50 姓氏 × 50 名字按互质映射组合，250 个姓名两两不同；再与既有运动员比对防冲突
 * - 幂等追加：重复运行会因姓名冲突加后缀，不会覆盖既有数据
 * - 训练计划执行日严格早于今天（最晚为昨天）
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** 生成「今日之前」的日期（n 天前，n>=1 保证早于今天） */
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** 确保名称唯一：与既有名称及本批已用名称比对，冲突则追加 -N 后缀 */
function makeUniqueName(existingSet, baseName) {
  let name = baseName;
  let i = 2;
  while (existingSet.has(name)) {
    name = `${baseName}-${i}`;
    i += 1;
  }
  existingSet.add(name);
  return name;
}

async function main() {
  console.log('开始生成 250 名运动员与 550 份历史训练计划...\n');

  // ---- 0. 前置校验 ----
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) throw new Error('未找到管理员账户（admin），请先初始化数据库');

  const existingAthleteNames = new Set(
    (await prisma.athlete.findMany({ select: { name: true } })).map((x) => x.name)
  );
  const exerciseIds = (await prisma.exercise.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map((x) => x.id);
  if (exerciseIds.length === 0) throw new Error('练习库为空，无法为训练计划生成训练项，请先初始化练习数据');

  const beforeAthletes = await prisma.athlete.count();
  const beforePlans = await prisma.trainingPlan.count();
  console.log(`当前数据：运动员 ${beforeAthletes} 名，练习动作 ${exerciseIds.length} 个，训练计划 ${beforePlans} 份\n`);

  // ============================================================
  // 1. 创建 250 名信息各不相同的虚拟运动员
  // ============================================================
  const surnames = [
    '赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈',
    '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许',
    '何', '吕', '施', '张', '孔', '曹', '严', '华', '金', '魏',
    '陶', '姜', '戚', '谢', '邹', '喻', '柏', '水', '窦', '章',
    '云', '苏', '潘', '葛', '奚', '范', '彭', '郎', '鲁', '韦',
  ];
  const givenNames = [
    '宇轩', '子涵', '雨桐', '浩然', '欣怡', '梓萱', '俊杰', '思远', '嘉懿', '若曦',
    '泽宇', '梦琪', '天佑', '静怡', '志强', '语嫣', '文博', '晓彤', '宇航', '梦洁',
    '睿哲', '婉婷', '明轩', '思琪', '浩宇', '紫萱', '宇杰', '佳琪', '晨曦', '雅婷',
    '伟宸', '诗涵', '雨泽', '欣妍', '子墨', '静雅', '沁然', '俊豪', '思彤', '梦瑶',
    '昊天', '诗婷', '俊熙', '语薇', '志豪', '婉如', '瑞霖', '嘉欣', '博文', '婷婷',
  ];
  const sports = [
    { sport: '田径', positions: ['短跑', '中长跑', '跳远', '跳高', '标枪', '铅球'] },
    { sport: '游泳', positions: ['自由泳', '蛙泳', '仰泳', '蝶泳', '混合泳'] },
    { sport: '篮球', positions: ['控卫', '得分后卫', '小前锋', '大前锋', '中锋'] },
    { sport: '足球', positions: ['前锋', '中场', '后卫', '门将'] },
    { sport: '排球', positions: ['主攻', '副攻', '二传', '接应', '自由人'] },
    { sport: '体操', positions: ['全能', '自由操', '鞍马', '吊环', '跳马', '双杠', '单杠'] },
    { sport: '羽毛球', positions: ['单打', '双打', '混双'] },
    { sport: '乒乓球', positions: ['正手', '反手', '弧圈'] },
    { sport: '网球', positions: ['单打', '双打'] },
    { sport: '举重', positions: ['抓举', '挺举'] },
    { sport: '柔道', positions: ['轻量级', '中量级', '重量级'] },
    { sport: '跆拳道', positions: ['品势', '竞技'] },
    { sport: '武术', positions: ['长拳', '南拳', '太极拳'] },
    { sport: '自行车', positions: ['公路', '山地', '场地'] },
    { sport: '射击', positions: ['步枪', '手枪'] },
    { sport: '击剑', positions: ['花剑', '重剑', '佩剑'] },
    { sport: '皮划艇', positions: ['静水', '激流回旋'] },
    { sport: '拳击', positions: ['轻量级', '次中量级', '重量级'] },
    { sport: '健美操', positions: ['单人操', '三人操', '集体操'] },
    { sport: '散打', positions: ['56kg级', '60kg级', '65kg级', '70kg级', '75kg级'] },
  ];

  const newAthleteIds = [];
  for (let idx = 0; idx < 250; idx += 1) {
    // 互质映射：250 个 (姓氏, 名字) 组合两两不同
    const baseName = surnames[idx % surnames.length] + givenNames[Math.floor(idx / 5) % givenNames.length];
    const name = makeUniqueName(existingAthleteNames, baseName);

    const gender = idx % 3 === 2 ? 'FEMALE' : 'MALE';
    const s = sports[idx % sports.length];
    const height = gender === 'FEMALE' ? 155 + (idx % 30) : 170 + (idx % 35);
    const weight = gender === 'FEMALE' ? 45 + (idx % 40) : 60 + (idx % 55);
    const birthDate = new Date(1990 + (idx % 18), idx % 12, 1 + ((idx * 7) % 28));
    const joinDate = daysAgo(365 + (idx % 5) * 365);

    const athlete = await prisma.athlete.create({
      data: {
        name,
        gender,
        birthDate,
        height,
        weight,
        sport: s.sport,
        position: s.positions[idx % s.positions.length],
        joinDate,
      },
    });
    newAthleteIds.push(athlete.id);
  }
  console.log(`✓ 运动员：新增 ${newAthleteIds.length} 名`);

  // ============================================================
  // 2. 创建 550 份「今日之前」的训练计划
  // ============================================================
  const goals = [
    '提升最大力量', '增强爆发力', '提高速度耐力', '改善核心稳定性', '强化下肢力量',
    '提升有氧耐力', '增强灵敏协调', '改善柔韧性', '备战专项比赛', '减脂塑形',
    '强化上肢力量', '提高反应速度', '优化技术动作', '促进恢复再生',
  ];
  const startTimes = ['07:00', '08:30', '09:00', '10:00', '14:00', '15:30', '16:30', '19:00'];
  const tempos = ['2-0-1-0', '3-0-2-0', '2-0-2-0', '1-0-1-0'];
  const rests = [30, 45, 60, 90, 120];
  const notesPool = ['重点观察技术动作', '注意控制训练强度', '加强核心收紧意识', '逐步增加负荷', '强调动作质量优先', '注意补水与休息'];

  const planIds = [];
  for (let idx = 0; idx < 550; idx += 1) {
    // 执行日期分布在过去 180 天，最晚为昨天（严格早于今日）
    const startDate = daysAgo(1 + (idx % 180));
    const goal = goals[idx % goals.length];
    const startTime = startTimes[idx % startTimes.length];

    const plan = await prisma.trainingPlan.create({
      data: {
        coachId: admin.id,
        goal,
        startDate,
        startTime,
        status: 'COMPLETED',
      },
    });

    // 计划关联 1-5 个练习项
    const itemCount = 1 + (idx % 5);
    for (let j = 0; j < itemCount; j += 1) {
      const exerciseId = exerciseIds[(idx * 3 + j * 7) % exerciseIds.length];
      await prisma.trainingPlanItem.create({
        data: {
          planId: plan.id,
          exerciseId,
          sets: 3 + (j % 4),
          reps: 6 + ((idx + j) % 10),
          load: 40 + ((idx * 11 + j * 17) % 120),
          restSeconds: rests[(idx + j) % rests.length],
          duration: 15 + ((idx + j) % 45),
          tempo: tempos[(idx + j) % tempos.length],
          sortOrder: j,
          notes: (idx + j) % 3 === 0 ? notesPool[(idx + j) % notesPool.length] : null,
        },
      });
    }

    // 计划关联 1-6 名新运动员
    const athleteCount = 1 + ((idx * 5) % 6);
    const added = new Set();
    for (let k = 0; k < athleteCount; k += 1) {
      const athleteId = newAthleteIds[(idx + k * 11) % newAthleteIds.length];
      if (added.has(athleteId)) continue;
      added.add(athleteId);
      await prisma.trainingPlanAthlete.create({
        data: { planId: plan.id, athleteId },
      });
    }

    planIds.push(plan.id);
  }
  console.log(`✓ 训练计划：新增 ${planIds.length} 份（全部早于今日）`);

  // ============================================================
  // 3. 汇总校验
  // ============================================================
  const afterAthletes = await prisma.athlete.count();
  const afterPlans = await prisma.trainingPlan.count();
  const planItems = await prisma.trainingPlanItem.count();
  const planAthletes = await prisma.trainingPlanAthlete.count();
  const latestPlan = await prisma.trainingPlan.findFirst({ orderBy: { startDate: 'desc' } });
  const now = new Date();
  const latestIsPast = latestPlan?.startDate ? latestPlan.startDate.getTime() < now.getTime() : false;

  console.log('\n========================================');
  console.log('批量数据生成完成！');
  console.log('========================================');
  console.log(`  运动员：${beforeAthletes} → ${afterAthletes}（新增 ${afterAthletes - beforeAthletes}）`);
  console.log(`  训练计划：${beforePlans} → ${afterPlans}（新增 ${afterPlans - beforePlans}）`);
  console.log(`  计划训练项：${planItems} 条`);
  console.log(`  计划运动员关联：${planAthletes} 条`);
  console.log(`  最晚计划执行日：${latestPlan?.startDate?.toISOString().slice(0, 10) ?? '无'}（早于今日：${latestIsPast ? '是' : '否'}）`);
}

main()
  .catch((e) => {
    console.error('生成失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
