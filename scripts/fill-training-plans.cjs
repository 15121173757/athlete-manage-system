/**
 * 补足「今日之前」的历史训练计划 —— 运动员管理系统（AMS）
 *
 * 用法：node scripts/fill-training-plans.cjs [数量]
 * 例：node scripts/fill-training-plans.cjs 15
 *
 * 创建指定数量的训练计划（COMPLETED，执行日严格早于今天），
 * 关联既有练习项与既有运动员。可用于补齐被中断的批量生成。
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  const need = Number(process.argv[2] || 0);
  if (!Number.isInteger(need) || need <= 0) {
    throw new Error('请提供要补足的计划数量（正整数），如：node scripts/fill-training-plans.cjs 15');
  }

  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) throw new Error('未找到管理员账户（admin）');

  const exerciseIds = (await prisma.exercise.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map((x) => x.id);
  if (exerciseIds.length === 0) throw new Error('练习库为空，无法生成训练项');

  const athleteIds = (await prisma.athlete.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map((x) => x.id);
  if (athleteIds.length === 0) throw new Error('运动员库为空，无法关联计划');

  const beforePlans = await prisma.trainingPlan.count();
  console.log(`当前训练计划 ${beforePlans} 份，准备补足 ${need} 份...\n`);

  const goals = [
    '提升最大力量', '增强爆发力', '提高速度耐力', '改善核心稳定性', '强化下肢力量',
    '提升有氧耐力', '增强灵敏协调', '改善柔韧性', '备战专项比赛', '减脂塑形',
    '强化上肢力量', '提高反应速度', '优化技术动作', '促进恢复再生',
  ];
  const startTimes = ['07:00', '08:30', '09:00', '10:00', '14:00', '15:30', '16:30', '19:00'];
  const tempos = ['2-0-1-0', '3-0-2-0', '2-0-2-0', '1-0-1-0'];
  const rests = [30, 45, 60, 90, 120];
  const notesPool = ['重点观察技术动作', '注意控制训练强度', '加强核心收紧意识', '逐步增加负荷', '强调动作质量优先', '注意补水与休息'];

  for (let idx = 0; idx < need; idx += 1) {
    const startDate = daysAgo(1 + (idx % 180));
    const plan = await prisma.trainingPlan.create({
      data: {
        coachId: admin.id,
        goal: goals[idx % goals.length],
        startDate,
        startTime: startTimes[idx % startTimes.length],
        status: 'COMPLETED',
      },
    });

    const itemCount = 1 + (idx % 5);
    for (let j = 0; j < itemCount; j += 1) {
      await prisma.trainingPlanItem.create({
        data: {
          planId: plan.id,
          exerciseId: exerciseIds[(idx * 3 + j * 7) % exerciseIds.length],
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

    const athleteCount = 1 + ((idx * 5) % 6);
    const added = new Set();
    for (let k = 0; k < athleteCount; k += 1) {
      const athleteId = athleteIds[(idx + k * 11) % athleteIds.length];
      if (added.has(athleteId)) continue;
      added.add(athleteId);
      await prisma.trainingPlanAthlete.create({
        data: { planId: plan.id, athleteId },
      });
    }
  }

  const afterPlans = await prisma.trainingPlan.count();
  const latestPlan = await prisma.trainingPlan.findFirst({ orderBy: { startDate: 'desc' } });
  console.log('========================================');
  console.log('补足完成！');
  console.log('========================================');
  console.log(`  训练计划：${beforePlans} → ${afterPlans}（新增 ${afterPlans - beforePlans}）`);
  console.log(`  最晚计划执行日：${latestPlan?.startDate?.toISOString().slice(0, 10) ?? '无'}（早于今日：${latestPlan?.startDate ? latestPlan.startDate.getTime() < Date.now() : false}）`);
}

main()
  .catch((e) => {
    console.error('补足失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
