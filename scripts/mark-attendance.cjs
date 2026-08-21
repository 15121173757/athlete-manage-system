/**
 * 批量标注出勤记录 —— 运动员管理系统（AMS）
 *
 * 用法：node scripts/mark-attendance.cjs
 *
 * 将所有「有计划但未标注」的出勤名额，按确定性规则分配 6 种出勤状态并写入出勤记录，
 * 用于测试出勤报告（团队/个人维度的状态占比、日程标注等）。
 *
 * 分配比例（按 (日期, 运动员) 排序后的序号）：
 *   出勤 PRESENT         70%
 *   伤缺 INJURED_ABSENT   8%
 *   事假 PERSONAL_LEAVE   8%
 *   外赛 COMPETITION      5%
 *   集训 TRAINING_CAMP    5%
 *   停训 SUSPENDED        4%
 *
 * 幂等：已存在的出勤记录不会被覆盖（createMany skipDuplicates）。
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function assignStatus(index) {
  const r = index % 100;
  if (r < 70) return 'PRESENT';
  if (r < 78) return 'INJURED_ABSENT';
  if (r < 86) return 'PERSONAL_LEAVE';
  if (r < 91) return 'COMPETITION';
  if (r < 96) return 'TRAINING_CAMP';
  return 'SUSPENDED';
}

async function main() {
  console.log('开始批量标注未标记的出勤名额...\n');

  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) throw new Error('未找到管理员账户（admin）');

  // 1. 收集「有计划」的名额（去重）；仅处理今天及之前的日期，
  //    未来日期的计划名额不允许提前标记出勤状态
  const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const pairs = await prisma.trainingPlanAthlete.findMany({
    where: {
      plan: { status: { in: ['SCHEDULED', 'COMPLETED'] }, startDate: { not: null } },
    },
    select: { athleteId: true, plan: { select: { startDate: true } } },
  });

  const slotMap = new Map(); // key: dateStr|athleteId
  let futureSkipped = 0;
  for (const p of pairs) {
    if (!p.plan.startDate) continue;
    const dateStr = toDateStr(p.plan.startDate);
    if (dateStr > todayStr) {
      futureSkipped += 1;
      continue; // 跳过未来日期的名额
    }
    const key = `${dateStr}|${p.athleteId}`;
    if (!slotMap.has(key)) slotMap.set(key, { dateStr, athleteId: p.athleteId });
  }
  if (futureSkipped > 0) {
    console.log(`已跳过 ${futureSkipped} 个未来日期的计划名额（不允许提前标记出勤状态）。`);
  }

  // 2. 已有出勤记录
  const existing = await prisma.attendanceRecord.findMany({
    select: { attendanceDate: true, athleteId: true },
  });
  const existingSet = new Set(existing.map((r) => `${toDateStr(r.attendanceDate)}|${r.athleteId}`));

  // 3. 未标记名额，按 (日期, 运动员) 排序后分配状态
  const unmarked = [...slotMap.values()]
    .filter((s) => !existingSet.has(`${s.dateStr}|${s.athleteId}`))
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.athleteId - b.athleteId);

  if (unmarked.length === 0) {
    console.log('没有需要标注的未标记名额。');
    return;
  }

  const rows = unmarked.map((s, index) => ({
    attendanceDate: new Date(`${s.dateStr}T00:00:00.000Z`),
    athleteId: s.athleteId,
    status: assignStatus(index),
    recordedById: admin.id,
  }));

  // 4. 批量写入（rows 已按唯一键去重并排除已有记录，SQLite 不支持 skipDuplicates）
  const result = await prisma.attendanceRecord.createMany({
    data: rows,
  });

  // 5. 汇总统计
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const afterCount = await prisma.attendanceRecord.count();

  // 6. 写一条汇总审计日志
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'BATCH_UPSERT_ATTENDANCE',
      targetType: 'AttendanceRecord',
      targetId: null,
      detail: JSON.stringify({ created: result.count, skipped: rows.length - result.count, byStatus: counts }),
    },
  });

  console.log('========================================');
  console.log('批量标注完成！');
  console.log('========================================');
  console.log(`  待标注名额：${unmarked.length}`);
  console.log(`  实际新增记录：${result.count}（跳过重复 ${rows.length - result.count}）`);
  console.log('  各状态分布：');
  for (const [status, n] of Object.entries(counts)) {
    console.log(`    ${status}: ${n}`);
  }
  console.log(`  当前出勤记录总数：${afterCount}`);
}

main()
  .catch((e) => {
    console.error('标注失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
