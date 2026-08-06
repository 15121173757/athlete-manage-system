/**
 * 训练负荷测试数据生成脚本（AMS）
 *
 * 为 6 名运动员生成 2026-07-01 至 2026-08-06（37 天，含完整自然月 7 月）的训练负荷数据，
 * 数据符合运动训练生理规律：按周周期化安排（力量/速度/耐力/柔韧/技巧/恢复），
 * 周间渐进超负荷，第 4 周达峰后减量（deload），存在合理波动。
 *
 * 用法：
 *   node scripts/generate-load-data.cjs            # 仅生成 JSON + 打印 EWMA 预估
 *   node scripts/generate-load-data.cjs --import   # 生成 JSON 并导入数据库（先清空 load_records）
 *
 * 输出：
 *   data/load-test-data.json —— 结构化数据，可直接导入负荷监控系统
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// ============================================================
// 配置
// ============================================================

const START_KEY = '2026-07-01';
const END_KEY = '2026-08-06'; // 与系统「今天」对齐，28 天窗口 = 7-10 ~ 8-06

/** 录入人（admin 用户 ID，审计留痕） */
const RECORDED_BY = 3;

/** 运动员个体训练水平系数（影响整体负荷水平，体现个体差异） */
const ATHLETES = [
  { id: 1, name: '刘月', factor: 1.0, tail: 2.4, expect: 'HIGH' },
  { id: 2, name: '李娜', factor: 0.9, tail: 1.0, expect: 'SAFE' },
  { id: 3, name: '王强', factor: 0.85, tail: 0.2, expect: 'LOW' },
  { id: 4, name: '赵敏', factor: 0.95, tail: 1.8, expect: 'ELEVATED' },
  { id: 5, name: '孙磊', factor: 1.15, tail: 1.0, expect: 'SAFE' },
  { id: 6, name: '周婷', factor: 1.05, tail: 2.6, expect: 'HIGH' },
];

/** 周模板：key = 星期几（0 周日 ~ 6 周六） */
const WEEK_TEMPLATE = [
  { type: '恢复', rpe: 2, minutes: 20 }, // 周日 主动恢复
  { type: '力量', rpe: 8, minutes: 75 }, // 周一 大力量
  { type: '速度', rpe: 7, minutes: 60 }, // 周二 速度
  { type: '耐力', rpe: 6, minutes: 120 }, // 周三 低强度长时间耐力
  null, // 周四 技巧/柔韧交替（下方处理）
  { type: '力量', rpe: 9, minutes: 60 }, // 周五 高强度力量
  { type: '耐力', rpe: 9, minutes: 90 }, // 周六 比赛模拟高强度
];

/** 周间周期化倍率：准备期渐进上升 → 第 4 周减量（deload）→ 尾部赛前冲击（由各运动员 tail 控制） */
function weekMultiplier(dateKey) {
  if (dateKey <= '2026-07-05') return 0.85; // 准备期
  if (dateKey <= '2026-07-12') return 0.9;
  if (dateKey <= '2026-07-19') return 0.95;
  if (dateKey <= '2026-07-26') return 1.0;
  if (dateKey <= '2026-08-02') return 0.8; // deload 减量
  return 0.85; // 尾部 7-31 起由 tail 覆盖
}

/** 尾部 7 天（7-31 ~ 8-06）索引范围 */
const TAIL_INDEX_START = 30;

// ============================================================
// 工具
// ============================================================

function dateKeyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function dateToKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDays() {
  const days = [];
  const start = dateKeyToDate(START_KEY);
  const end = dateKeyToDate(END_KEY);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({ key: dateToKey(d), weekday: d.getDay(), index: days.length });
  }
  return days;
}

/** 与 LoadService 相同的 EWMA 递推 */
function computeEwma(values, lambda) {
  if (values.length === 0) return 0;
  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = values[i] * lambda + ewma * (1 - lambda);
  }
  return ewma;
}

/** 预估 ACWR（模拟系统近 28 天窗口 = 以 8-06 截止） */
function estimateAcwr(recordsByDate) {
  const keys = [];
  for (let d = dateKeyToDate('2026-07-10'); d <= dateKeyToDate(END_KEY); d.setDate(d.getDate() + 1)) {
    keys.push(dateToKey(d));
  }
  const daily = keys.map((k) => recordsByDate.get(k) ?? 0);
  const acute = computeEwma(daily.slice(-7), 2 / 8);
  const chronic = computeEwma(daily, 2 / 29);
  const acwr = chronic > 0 && Number.isFinite(acute) && Number.isFinite(chronic)
    ? Math.round((acute / chronic) * 100) / 100
    : null;
  return { acute, chronic, acwr };
}

// ============================================================
// 生成
// ============================================================

function generate() {
  const days = buildDays();
  const allRecords = [];
  const perAthlete = [];

  for (const a of ATHLETES) {
    const byDate = new Map();
    for (const day of days) {
      let template = WEEK_TEMPLATE[day.weekday];
      if (day.weekday === 4) {
        // 周四：技巧/柔韧按周交替，覆盖两种训练类型
        const weekIdx = Math.floor(day.index / 7);
        template = weekIdx % 2 === 0
          ? { type: '技巧', rpe: 5, minutes: 75 }
          : { type: '柔韧', rpe: 4, minutes: 60 };
      }
      if (!template) continue;

      const m = day.index >= TAIL_INDEX_START ? a.tail : weekMultiplier(day.key);
      const minutes = Math.max(10, Math.round(template.minutes * m * a.factor));

      allRecords.push({
        athleteId: a.id,
        recordDate: day.key,
        rpe: template.rpe,
        durationMinutes: minutes,
        trainingType: template.type,
        notes: `测试数据 ${day.key} ${template.type}训练`,
      });
      byDate.set(day.key, template.rpe * minutes);
    }

    const est = estimateAcwr(byDate);
    const level = est.acwr === null ? 'NO_DATA'
      : est.acwr < 0.8 ? 'LOW'
      : est.acwr <= 1.3 ? 'SAFE'
      : est.acwr <= 1.5 ? 'ELEVATED'
      : 'HIGH';
    perAthlete.push({ athleteId: a.id, name: a.name, expect: a.expect, level, ...est });
  }

  return { allRecords, perAthlete };
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const doImport = process.argv.includes('--import');
  const { allRecords, perAthlete } = generate();

  // 1. 输出 JSON 文件
  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'load-test-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allRecords, null, 2), 'utf-8');

  // 2. 打印预估
  console.log(`已生成 ${allRecords.length} 条负荷记录 → ${jsonPath}\n`);
  console.log('| 运动员 | 期望区间 | 预估区间 | ACWR | 急性EWMA | 慢性EWMA |');
  console.log('|---|---|---|---|---|---|');
  let allOk = true;
  for (const p of perAthlete) {
    const ok = p.level === p.expect;
    if (!ok) allOk = false;
    console.log(`| ${p.name} | ${p.expect} | ${p.level}${ok ? ' ✓' : ' ✗'} | ${p.acwr === null ? '—' : p.acwr.toFixed(2)} | ${Math.round(p.acute)} | ${Math.round(p.chronic)} |`);
  }

  // 类型覆盖检查
  const types = [...new Set(allRecords.map((r) => r.trainingType))];
  console.log(`\n训练类型覆盖：${types.join(' / ')}`);

  // 3. 导入
  if (doImport) {
    await prisma.loadRecord.deleteMany({});
    await prisma.loadRecord.createMany({
      data: allRecords.map((r) => ({
        athleteId: r.athleteId,
        recordDate: dateKeyToDate(r.recordDate),
        rpe: r.rpe,
        durationMinutes: r.durationMinutes,
        trainingType: r.trainingType,
        notes: r.notes,
        recordedById: RECORDED_BY,
      })),
    });
    const count = await prisma.loadRecord.count();
    console.log(`\n导入完成：load_records 共 ${count} 条`);
  } else {
    console.log('\n（未导入，使用 --import 可写入数据库）');
  }

  await prisma.$disconnect();
  process.exit(allOk ? 0 : 0); // 预估不匹配不视为失败，仅提示
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
