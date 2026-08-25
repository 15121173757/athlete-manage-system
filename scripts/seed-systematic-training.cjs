/**
 * 系统性训练规划种子脚本（2026-05-20 起）
 * ------------------------------------------------------------
 * 1. 自 2026-05-20 起（截至 2026-08-24），每 7 天为一训练周，
 *    每周为每位运动员生成 4 份 COMPLETED 训练计划（力量/速度敏捷/耐力/柔韧恢复），
 *    每份计划含 10 个练习项（>= 8），覆盖力量、耐力、速度、敏捷、柔韧等素质，
 *    完整填写组数、次数、负荷、间歇、节奏、预计时长等参数。
 * 2. 为每次训练生成训练记录（实际组数/次数/负荷 + RPE + 训练日期）与出勤记录
 *    （状态 + 训练时长 + RPE）。
 * 3. 按月（2026-05/06/07/08 月底）为全体运动员生成标准化体能测试计划，
 *    测试项目与日常训练内容匹配，并生成完整测试结果样本（FitnessTestResult +
 *    同步 FitnessRecord）。
 *
 * 运行：node scripts/seed-systematic-training.cjs
 * 可重复执行：脚本开头会清理本脚本此前生成的标记数据（goal/name 前缀）。
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GOAL_PREFIX = '[系统性训练规划]';
const PLAN_PREFIX = '[系统性测试规划]';

const START = '2026-05-20';
const END = '2026-08-24';
const WEEK_OFFSETS = [0, 1, 3, 5]; // 每周 4 个训练日偏移
const TYPE_BY_OFFSET = { 0: '力量', 1: '速度敏捷', 3: '耐力', 5: '柔韧恢复' };
const START_TIME_BY_TYPE = { 力量: '06:30', 速度敏捷: '06:30', 耐力: '16:00', 柔韧恢复: '18:30' };

// ============ 工具 ============
function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}
function utc0(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function pickRange([lo, hi], seed) {
  return lo + (seed % (hi - lo + 1));
}

// ============ PB 全量重算（复刻 lib/modules/pb/PBService.recomputeAllPBs，规避 .cjs 无法 require TS） ============
const TRACK_FIELD_OF = {
  MAX_WEIGHT: 'load',
  MAX_REPS: 'reps',
  MAX_TIME: 'metric',
  MIN_TIME: 'metric',
  MAX_HEIGHT: 'metric',
  MAX_DISTANCE: 'metric',
};
function extractMetricValue(record, trackType) {
  switch (TRACK_FIELD_OF[trackType] ?? 'reps') {
    case 'load':
      return record.actualLoad ?? 0;
    case 'reps':
      return record.actualReps;
    case 'metric':
      return record.metricValue ?? record.actualReps ?? 0;
    default:
      return record.actualReps;
  }
}
async function recomputePBs() {
  const exercises = await prisma.exercise.findMany({
    where: { isPBTrackable: true },
    select: { id: true, unit: true, trackType: true },
  });
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const records = await prisma.trainingRecord.findMany({
    where: { exerciseId: { in: Array.from(exMap.keys()) } },
    select: { id: true, athleteId: true, exerciseId: true, actualSets: true, actualReps: true, actualLoad: true, metricValue: true, trainingDate: true },
  });
  const bestMap = new Map();
  for (const rec of records) {
    const meta = exMap.get(rec.exerciseId);
    if (!meta) continue;
    const value = extractMetricValue(rec, meta.trackType);
    if (value <= 0) continue;
    const dir = meta.trackType === 'MIN_TIME' ? 'LOWER_BETTER' : 'HIGHER_BETTER';
    const key = `${rec.athleteId}-${rec.exerciseId}`;
    const cur = bestMap.get(key);
    if (!cur || (dir === 'LOWER_BETTER' ? value < cur.value : value > cur.value)) {
      bestMap.set(key, { value, recordId: rec.id, achievedDate: rec.trainingDate, unit: meta.unit });
    }
  }
  await prisma.personalBest.deleteMany({});
  const rows = Array.from(bestMap.entries()).map(([key, info]) => {
    const [athleteId, exerciseId] = key.split('-').map(Number);
    return { athleteId, exerciseId, value: info.value, unit: info.unit, achievedDate: info.achievedDate, recordId: info.recordId };
  });
  for (const batch of chunk(rows, 2000)) {
    await prisma.personalBest.createMany({ data: batch });
  }
  console.log('    recomputed PBs:', rows.length);
  return rows.length;
}

// ============ 训练日列表 ============
const trainDays = [];
let week = 0;
for (;;) {
  const weekStart = addDays(START, week * 7);
  for (const off of WEEK_OFFSETS) {
    const ds = addDays(weekStart, off);
    if (ds > END) continue;
    trainDays.push({ dateStr: ds, date: utc0(ds), type: TYPE_BY_OFFSET[off], week });
  }
  if (addDays(weekStart, 7) > END) break;
  week += 1;
}
const TOTAL_WEEKS = week + 1;

// ============ 练习项模板（10 项/份，覆盖多素质） ============
// l: 'ST' 力量负荷 / 'POW' 爆发力负荷 / null 自重；dur 为预计时长（分钟）
const T = {
  力量: [
    [
      { e: 1, s: [3, 5], r: [5, 8], l: 'ST', t: '2-0-1-0', rest: 120 },
      { e: 2, s: [3, 4], r: [5, 8], l: 'ST', t: '2-1-1-0', rest: 90 },
      { e: 3, s: [3, 4], r: [3, 5], l: 'ST', t: '2-0-1-0', rest: 120 },
      { e: 4, s: [3, 4], r: [6, 8], l: 'ST', t: '2-0-1-0', rest: 90 },
      { e: 5, s: [3, 4], r: [6, 10], l: null, t: '1-1-1-0', rest: 60 },
      { e: 26, s: [4, 5], r: [3, 5], l: 'POW', t: null, rest: 150 },
      { e: 30, s: [4, 5], r: [4, 6], l: null, t: null, rest: 120 },
      { e: 60, s: [1, 2], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 63, s: [2, 3], r: [15, 20], l: null, t: null, rest: 20 },
      { e: 64, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
    ],
    [
      { e: 18, s: [3, 5], r: [5, 8], l: 'ST', t: '2-0-1-0', rest: 120 },
      { e: 20, s: [3, 4], r: [6, 10], l: 'ST', t: '2-1-1-0', rest: 90 },
      { e: 22, s: [3, 4], r: [5, 8], l: 'ST', t: '2-0-1-0', rest: 120 },
      { e: 25, s: [3, 4], r: [8, 10], l: 'ST', t: '2-0-1-0', rest: 90 },
      { e: 23, s: [3, 4], r: [4, 6], l: 'ST', t: '2-0-1-0', rest: 120 },
      { e: 28, s: [4, 5], r: [8, 12], l: 'POW', t: null, rest: 120 },
      { e: 29, s: [4, 5], r: [4, 6], l: null, t: null, rest: 120 },
      { e: 60, s: [1, 2], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 62, s: [2, 3], r: [12, 16], l: null, t: null, rest: 20 },
      { e: 65, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 6 },
    ],
    [
      { e: 19, s: [3, 4], r: [5, 8], l: 'ST', t: '2-0-1-0', rest: 120 },
      { e: 21, s: [3, 4], r: [8, 12], l: 'ST', t: '2-1-1-0', rest: 90 },
      { e: 24, s: [3, 4], r: [5, 8], l: 'ST', t: '2-0-1-0', rest: 90 },
      { e: 5, s: [3, 4], r: [6, 10], l: null, t: '1-1-1-0', rest: 60 },
      { e: 27, s: [4, 5], r: [3, 5], l: 'POW', t: null, rest: 150 },
      { e: 31, s: [3, 4], r: [4, 6], l: null, t: null, rest: 120 },
      { e: 32, s: [4, 5], r: [6, 10], l: 'POW', t: null, rest: 90 },
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 63, s: [2, 3], r: [15, 20], l: null, t: null, rest: 20 },
      { e: 64, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
    ],
  ],
  速度敏捷: [
    [
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 60, s: [1, 2], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 34, s: [4, 6], r: [2, 3], l: null, t: null, rest: 90 },
      { e: 35, s: [4, 6], r: [2, 3], l: null, t: null, rest: 120 },
      { e: 38, s: [4, 5], r: [2, 3], l: null, t: null, rest: 90 },
      { e: 36, s: [4, 5], r: [8, 10], l: null, t: null, rest: 60 },
      { e: 37, s: [4, 5], r: [2, 3], l: null, t: null, rest: 120 },
      { e: 41, s: [4, 5], r: [2, 3], l: null, t: null, rest: 90 },
      { e: 62, s: [1, 2], r: [12, 16], l: null, t: null, rest: 20 },
      { e: 64, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
    ],
    [
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 60, s: [1, 2], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 7, s: [4, 6], r: [2, 3], l: null, t: null, rest: 120 },
      { e: 8, s: [4, 5], r: [2, 3], l: null, t: null, rest: 90 },
      { e: 13, s: [4, 6], r: [2, 3], l: null, t: null, rest: 120 },
      { e: 40, s: [4, 5], r: [6, 8], l: null, t: null, rest: 60 },
      { e: 39, s: [4, 5], r: [2, 3], l: null, t: null, rest: 120 },
      { e: 36, s: [4, 5], r: [8, 10], l: null, t: null, rest: 60 },
      { e: 63, s: [2, 3], r: [15, 20], l: null, t: null, rest: 20 },
      { e: 65, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 6 },
    ],
  ],
  耐力: [
    [
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 62, s: [1, 2], r: [12, 16], l: null, t: null, rest: 20 },
      { e: 48, s: [4, 6], r: [4, 6], l: null, t: null, rest: 45, dur: 12 },
      { e: 42, s: [3, 4], r: 1, l: null, t: null, rest: 60, dur: 5 },
      { e: 43, s: [2, 3], r: 1, l: null, t: null, rest: 90, dur: 8 },
      { e: 44, s: [1, 2], r: 1, l: null, t: null, rest: 120, dur: 15 },
      { e: 46, s: [3, 4], r: [8, 12], l: null, t: null, rest: 45, dur: 10 },
      { e: 47, s: [3, 4], r: [12, 15], l: null, t: null, rest: 30, dur: 8 },
      { e: 60, s: [1, 2], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 65, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 6 },
    ],
    [
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 60, s: [1, 2], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 49, s: [2, 3], r: 1, l: null, t: null, rest: 60, dur: 15 },
      { e: 45, s: [1, 2], r: 1, l: null, t: null, rest: 120, dur: 25 },
      { e: 9, s: [1, 2], r: 1, l: null, t: null, rest: 60, dur: 10 },
      { e: 14, s: [1, 2], r: 1, l: null, t: null, rest: 90, dur: 20 },
      { e: 48, s: [4, 5], r: [4, 6], l: null, t: null, rest: 45, dur: 12 },
      { e: 5, s: [3, 4], r: [8, 12], l: null, t: '1-0-1-0', rest: 60 },
      { e: 64, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
      { e: 67, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
    ],
  ],
  柔韧恢复: [
    [
      { e: 62, s: [2, 3], r: [12, 16], l: null, t: null, rest: 15 },
      { e: 60, s: [2, 3], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 64, s: [2, 3], r: 1, l: null, t: null, rest: 0, dur: 8 },
      { e: 65, s: [2, 3], r: 1, l: null, t: null, rest: 0, dur: 8 },
      { e: 66, s: [2, 3], r: 1, l: null, t: null, rest: 0, dur: 5 },
      { e: 67, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
      { e: 63, s: [2, 3], r: [15, 20], l: null, t: null, rest: 20 },
      { e: 47, s: [2, 3], r: [10, 15], l: null, t: null, rest: 30 },
      { e: 64, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
    ],
    [
      { e: 61, s: [1, 2], r: 1, l: null, t: null, rest: 15, dur: 8 },
      { e: 60, s: [2, 3], r: [10, 12], l: null, t: null, rest: 15 },
      { e: 55, s: [2, 3], r: 1, l: null, t: null, rest: 30, dur: 10 },
      { e: 66, s: [2, 3], r: 1, l: null, t: null, rest: 0, dur: 5 },
      { e: 64, s: [2, 3], r: 1, l: null, t: null, rest: 0, dur: 8 },
      { e: 65, s: [2, 3], r: 1, l: null, t: null, rest: 0, dur: 8 },
      { e: 67, s: [1, 2], r: 1, l: null, t: null, rest: 0, dur: 5 },
      { e: 62, s: [2, 3], r: [12, 16], l: null, t: null, rest: 15 },
      { e: 47, s: [2, 3], r: [10, 15], l: null, t: null, rest: 30 },
      { e: 63, s: [2, 3], r: [12, 15], l: null, t: null, rest: 20 },
    ],
  ],
};

// ============ 参数计算 ============
function buildItem(item, vi, athleteId, wk, gender) {
  const sets = Array.isArray(item.s) ? pickRange(item.s, athleteId * 5 + wk * 11 + vi * 7) : item.s;
  const reps = Array.isArray(item.r) ? pickRange(item.r, athleteId * 7 + wk * 13 + vi * 3) : item.r;
  let load = null;
  if (item.l === 'ST') {
    load = gender === 'FEMALE'
      ? 35 + ((wk * 2) % 20) + ((athleteId % 6) * 4)
      : 55 + ((wk * 2) % 26) + ((athleteId % 6) * 6);
  } else if (item.l === 'POW') {
    load = gender === 'FEMALE'
      ? 15 + ((wk * 2) % 15) + ((athleteId % 4) * 3)
      : 30 + ((wk * 2) % 20) + ((athleteId % 4) * 5);
  }
  return {
    exerciseId: item.e,
    sets,
    reps,
    load,
    restSeconds: item.rest,
    duration: item.dur ?? null,
    tempo: item.t ?? null,
  };
}

function sessionParams(type, wk, athleteId) {
  switch (type) {
    case '力量':
      return { dur: 90 + ((wk * 3 + athleteId) % 4) * 10, rpe: 6 + ((wk * 5 + athleteId) % 3) }; // 6-8
    case '速度敏捷':
      return { dur: 80 + ((wk * 2 + athleteId) % 3) * 15, rpe: 7 + ((wk * 3 + athleteId) % 3) }; // 7-9
    case '耐力':
      return { dur: 90 + ((wk + athleteId) % 4) * 10, rpe: 7 + ((wk * 2 + athleteId) % 3) }; // 7-9
    default:
      return { dur: 55 + ((wk * 3 + athleteId) % 3) * 10, rpe: 3 + ((wk + athleteId) % 3) }; // 3-5
  }
}

function assignStatus(athleteId, dayIdx) {
  const r = (athleteId * 7919 + dayIdx * 104729) % 100;
  if (r < 92) return 'PRESENT';
  if (r < 94) return 'INJURED_ABSENT';
  if (r < 97) return 'PERSONAL_LEAVE';
  if (r < 98) return 'COMPETITION';
  if (r < 99) return 'TRAINING_CAMP';
  return 'SUSPENDED';
}

// ============ 月度测试计划数据 ============
const TEST_MONTHS = ['五', '六', '七', '八'];
const TEST_DATES = ['2026-05-30', '2026-06-27', '2026-07-25', '2026-08-22'];
const TEST_ITEMS = [1, 2, 3, 17, 75, 12, 6, 35, 23, 72]; // 与训练内容匹配的标准化测试项

function testValue(testId, athleteId, gender, period) {
  // period: 0..3（月份递增，体现循序渐进）
  switch (testId) {
    case 1: // 1RM 深蹲 kg (HIGHER)
      return gender === 'FEMALE' ? 58 + (athleteId % 5) * 4 + period * 2 : 92 + (athleteId % 5) * 5 + period * 2.5;
    case 2: // 1RM 卧推 kg
      return gender === 'FEMALE' ? 30 + (athleteId % 6) * 3 + period * 1.2 : 58 + (athleteId % 8) * 5 + period * 1.5;
    case 3: // 纵跳高度 cm
      return 38 + (athleteId % 6) * 3 + period * 0.5;
    case 17: // 引体向上 次
      return 3 + (athleteId % 10) * 2 + Math.round(period * 1.2);
    case 75: // 30米冲刺 s (LOWER)
      return 4.12 + (athleteId % 8) * 0.05 - period * 0.012;
    case 12: // YO-YO IR1 m
      return 1000 + (athleteId % 10) * 120 + period * 35;
    case 6: // 坐位体前屈 cm
      return -3 + (athleteId % 12) * 2 + period * 0.6;
    case 35: // 折返跑10×5 s (LOWER)
      return 22 + (athleteId % 10) * 0.3 - period * 0.06;
    case 23: // 立定跳远 m
      return gender === 'FEMALE' ? 1.7 + (athleteId % 6) * 0.06 + period * 0.012 : 2.1 + (athleteId % 8) * 0.07 + period * 0.015;
    case 72: // 库珀12分钟跑 m
      return 1900 + (athleteId % 14) * 80 + period * 30;
    default:
      return 0;
  }
}

// ============ 主流程 ============
async function main() {
  const [athletes, exercises, coachUser, adminUser] = await Promise.all([
    prisma.athlete.findMany({ orderBy: { id: 'asc' } }),
    prisma.exercise.findMany(),
    prisma.user.findFirst({ where: { username: 'coach' } }),
    prisma.user.findFirst({ where: { username: 'admin' } }),
  ]);
  const coach = coachUser ?? adminUser;
  if (!coach) throw new Error('No coach/admin user found');
  const coachId = coach.id;

  const exerciseUnit = new Map(exercises.map((x) => [x.id, x.unit]));
  const athleteIds = athletes.map((a) => a.id);
  const genderById = new Map(athletes.map((a) => [a.id, a.gender]));

  console.log('[1/9] Loaded', athletes.length, 'athletes,', exercises.length, 'exercises; operator =', coach.username);

  // ---------------- 清理历史种子数据 ----------------
  console.log('[2/9] Cleaning previous seed data...');
  const oldPlans = await prisma.trainingPlan.findMany({
    where: { goal: { startsWith: GOAL_PREFIX } },
    select: { id: true },
  });
  if (oldPlans.length > 0) {
    const oldPlanIds = oldPlans.map((x) => x.id);
    const oldItems = await prisma.trainingPlanItem.findMany({
      where: { planId: { in: oldPlanIds } },
      select: { id: true },
    });
    const oldItemIds = oldItems.map((x) => x.id);
    if (oldItemIds.length > 0) {
      await prisma.trainingRecord.deleteMany({ where: { planItemId: { in: oldItemIds } } });
    }
    await prisma.trainingPlan.deleteMany({ where: { id: { in: oldPlanIds } } });
  }
  await prisma.attendanceRecord.deleteMany({
    where: { attendanceDate: { in: trainDays.map((d) => d.date) }, athleteId: { in: athleteIds } },
  });
  const oldTestPlans = await prisma.fitnessTestPlan.findMany({
    where: { name: { startsWith: PLAN_PREFIX } },
    select: { id: true },
  });
  if (oldTestPlans.length > 0) {
    await prisma.fitnessTestPlan.deleteMany({ where: { id: { in: oldTestPlans.map((x) => x.id) } } });
  }
  await prisma.fitnessRecord.deleteMany({
    where: { testDate: { in: TEST_DATES.map(utc0) } },
  });
  console.log('    cleaned:', oldPlans.length, 'old plans;', oldTestPlans.length, 'old test plans');

  // ---------------- 生成训练计划 ----------------
  console.log('[3/9] Generating training plans...');
  const planMeta = []; // { id?, ..., dayIdx, athleteId, type, week, dateStr }
  let dayIdx = 0;
  for (const day of trainDays) {
    for (const aid of athleteIds) {
      planMeta.push({
        coachId,
        goal: `${GOAL_PREFIX} ${day.type}训练 ${day.dateStr}（第${day.week + 1}周）`,
        startDate: day.date,
        startTime: START_TIME_BY_TYPE[day.type],
        status: 'COMPLETED',
        dayIdx,
        athleteId: aid,
        type: day.type,
        week: day.week,
      });
    }
    dayIdx += 1;
  }

  for (const batch of chunk(planMeta, 1000)) {
    const created = await prisma.trainingPlan.createManyAndReturn({
      data: batch.map(({ dayIdx, athleteId, type, week, ...row }) => row),
    });
    created.forEach((row, i) => {
      batch[i].id = row.id;
    });
  }
  console.log('    created plans:', planMeta.length);

  // ---------------- 生成练习项 ----------------
  console.log('[4/9] Generating plan items...');
  const itemRows = []; // 含 planId / id（回填）/ 会话元数据
  const itemsByPlan = new Map(); // planId -> item[]
  for (const plan of planMeta) {
    const variants = T[plan.type];
    const variant = variants[plan.week % variants.length];
    const gender = genderById.get(plan.athleteId);
    const session = sessionParams(plan.type, plan.week, plan.athleteId);
    const itemArr = [];
    variant.forEach((vi, idx) => {
      const b = buildItem(vi, idx, plan.athleteId, plan.week, gender);
      const item = {
        planId: plan.id,
        exerciseId: b.exerciseId,
        sets: b.sets,
        reps: b.reps,
        load: b.load,
        restSeconds: b.restSeconds,
        duration: b.duration,
        tempo: b.tempo,
        sortOrder: idx,
        athleteId: null,
        // 会话元数据（供训练记录使用）
        dayType: plan.type,
        week: plan.week,
        athleteId_: plan.athleteId,
        dateStr: plan.startDate.toISOString().slice(0, 10),
        rpe: session.rpe,
      };
      itemArr.push(item);
      itemRows.push(item);
    });
    itemsByPlan.set(plan.id, itemArr);
  }

  for (const batch of chunk(itemRows, 1000)) {
    const created = await prisma.trainingPlanItem.createManyAndReturn({
      data: batch.map(({ dayType, week, athleteId_, dateStr, rpe, ...row }) => row),
    });
    created.forEach((row, i) => {
      batch[i].id = row.id;
    });
  }
  console.log('    created items:', itemRows.length);

  // ---------------- 计划-运动员关联 ----------------
  console.log('[5/9] Linking plans to athletes...');
  const paRows = planMeta.map((plan) => ({ planId: plan.id, athleteId: plan.athleteId }));
  for (const batch of chunk(paRows, 2000)) {
    await prisma.trainingPlanAthlete.createMany({ data: batch });
  }
  console.log('    linked:', paRows.length);

  // ---------------- 出勤记录 ----------------
  console.log('[6/9] Generating attendance records...');
  const attRows = [];
  dayIdx = 0;
  for (const day of trainDays) {
    for (const aid of athleteIds) {
      const status = assignStatus(aid, dayIdx);
      const session = sessionParams(day.type, day.week, aid);
      attRows.push({
        attendanceDate: day.date,
        athleteId: aid,
        status,
        rpe: status === 'PRESENT' ? session.rpe : null,
        durationMinutes: status === 'PRESENT' ? session.dur : null,
        notes: status === 'PRESENT' ? '系统性训练规划出勤记录' : null,
        recordedById: coachId,
        dayIdx,
      });
    }
    dayIdx += 1;
  }
  const presentSet = new Set();
  for (const r of attRows) {
    if (r.status === 'PRESENT') presentSet.add(`${r.dayIdx}:${r.athleteId}`);
  }
  for (const batch of chunk(attRows, 2000)) {
    await prisma.attendanceRecord.createMany({
      data: batch.map(({ dayIdx, ...row }) => row),
    });
  }
  console.log('    attendance:', attRows.length, 'present:', presentSet.size);

  // ---------------- 训练记录 ----------------
  console.log('[7/9] Generating training records...');
  const recordList = [];
  for (const plan of planMeta) {
    if (!presentSet.has(`${plan.dayIdx}:${plan.athleteId}`)) continue;
    const itemMeta = itemsByPlan.get(plan.id) ?? [];
    for (const it of itemMeta) {
      let metricValue = null;
      if (it.load == null) {
        const unit = exerciseUnit.get(it.exerciseId);
        if (unit === '秒') {
          metricValue = Math.round((7.2 + ((plan.athleteId + plan.week * 3) % 24) * 0.09) * 100) / 100;
        } else if (unit === '米') {
          metricValue = 600 + ((plan.athleteId + plan.week * 11) % 45) * 80;
        } else if (unit === 'cm') {
          // 高度类练习（跳箱/蹲跳/跳深）：生成合理高度（cm），随周数渐进提升，保证 PB 可追踪
          metricValue = Math.round((45 + ((plan.athleteId + plan.week * 7) % 20) + plan.week * 0.4) * 10) / 10;
        }
      }
      recordList.push({
        athleteId: plan.athleteId,
        planItemId: it.id,
        exerciseId: it.exerciseId,
        actualSets: it.sets,
        actualReps: it.reps,
        actualLoad: it.load,
        metricValue,
        trainingDate: plan.startDate,
        rpe: it.rpe,
        notes: `${GOAL_PREFIX} 完成记录`,
        recordedById: coachId,
      });
    }
  }
  for (const batch of chunk(recordList, 2000)) {
    await prisma.trainingRecord.createMany({ data: batch });
  }
  console.log('    records:', recordList.length);

  // ---------------- 月度标准化测试计划 ----------------
  console.log('[8/9] Generating monthly fitness test plans...');
  let testResultsTotal = 0;
  for (let pi = 0; pi < TEST_DATES.length; pi++) {
    const testDate = TEST_DATES[pi];
    const plan = await prisma.fitnessTestPlan.create({
      data: {
        name: `${PLAN_PREFIX} ${TEST_MONTHS[pi]}月标准化体能测试（2026）`,
        testDate: utc0(testDate),
        startTime: '09:00',
        estimatedDuration: 180,
        location: '综合体能训练馆',
        weather: '晴',
        venueCondition: '良好',
        status: 'COMPLETED',
        notes: '与日常训练内容匹配的月度标准化测试（力量/爆发/速度/耐力/柔韧/敏捷）',
        createdById: coachId,
      },
    });

    await prisma.fitnessTestPlanItem.createMany({
      data: TEST_ITEMS.map((tid, idx) => ({
        planId: plan.id,
        testId: tid,
        sortOrder: idx,
        groupName: idx < 3 ? '力量与爆发力组' : idx < 6 ? '速度与耐力组' : '柔韧敏捷与综合组',
        allocatedMinutes: 15,
        equipmentReady: true,
      })),
    });
    await prisma.fitnessTestPlanParticipant.createMany({
      data: athleteIds.map((aid) => ({ planId: plan.id, athleteId: aid })),
    });

    const resultRows = [];
    const recRows = [];
    for (const aid of athleteIds) {
      for (const tid of TEST_ITEMS) {
        const value = Math.round(testValue(tid, aid, genderById.get(aid), pi) * 100) / 100;
        resultRows.push({
          planId: plan.id,
          athleteId: aid,
          testId: tid,
          rawValue: String(value),
          value,
          gradeValue: null,
          textValue: null,
          recordedById: coachId,
        });
        recRows.push({ athleteId: aid, testId: tid, value, testDate: utc0(testDate), recordedById: coachId });
      }
    }
    for (const batch of chunk(resultRows, 2000)) {
      await prisma.fitnessTestResult.createMany({ data: batch });
    }
    for (const batch of chunk(recRows, 2000)) {
      await prisma.fitnessRecord.createMany({ data: batch });
    }
    testResultsTotal += resultRows.length;
    console.log('    test plan #', pi + 1, testDate, 'results:', resultRows.length);
  }

  // ---------------- PB 全量重算（基于本次生成的训练记录） ----------------
  console.log('[9/10] Recomputing all personal bests...');
  const pbCount = await recomputePBs();

  // ---------------- 汇总 ----------------
  console.log('[10/10] Done.');
  console.log('SUMMARY',
    JSON.stringify({
      period: `${START} ~ ${END}`,
      totalWeeks: TOTAL_WEEKS,
      plansPerAthletePerWeek: WEEK_OFFSETS.length,
      itemsPerPlan: Math.max(...Object.values(T).map((v) => v[0].length)),
      trainingPlans: planMeta.length,
      planItems: itemRows.length,
      attendance: attRows.length,
      presentSlots: presentSet.size,
      trainingRecords: recordList.length,
      personalBests: pbCount,
      testPlans: TEST_DATES.length,
      testResults: testResultsTotal,
    }, null, 2)
  );
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());