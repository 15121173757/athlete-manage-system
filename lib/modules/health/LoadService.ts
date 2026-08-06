/**
 * 负荷监控业务服务 —— 伤病与负荷监控模块（AMS）
 *
 * 职责：
 * 1. 训练负荷记录录入（RPE × 训练时长）
 * 2. 按运动员统计每日/每周训练量（sRPE 方法：训练量 = RPE × 训练分钟数）
 * 3. 基于指数加权移动平均（EWMA）计算急慢性负荷比（ACWR）并分级
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';
import type { AcwrRiskLevel } from './loadConstants';

// ============================================================
// 常量与类型
// ============================================================

/** 急性负荷窗口（天）：近 7 天 */
export const ACWR_ACUTE_DAYS = 7;
/** 慢性负荷窗口（天）：近 28 天 */
export const ACWR_CHRONIC_DAYS = 28;
/**
 * EWMA 衰减因子 λ = 2 / (N + 1)，N 为窗口天数。
 * 急性（7 天）λ=0.25；慢性（28 天）λ=2/29≈0.069
 */
export const EWMA_ACUTE_LAMBDA = 2 / (ACWR_ACUTE_DAYS + 1);
export const EWMA_CHRONIC_LAMBDA = 2 / (ACWR_CHRONIC_DAYS + 1);

/** ACWR 风险分级阈值（严格依据 ACWR 数值判定） */
export const ACWR_LOW_MAX = 0.8; // ACWR < 0.8 → LOW（负荷不足）
export const ACWR_SAFE_MAX = 1.3; // 0.8 ≤ ACWR ≤ 1.3 → SAFE（舒适区）
export const ACWR_ELEVATED_MAX = 1.5; // 1.3 < ACWR ≤ 1.5 → ELEVATED（风险升高）；> 1.5 → HIGH（危险区）

/** 风险优先级（用于风险预警排序：高风险最优先） */
const RISK_PRIORITY: Record<AcwrRiskLevel, number> = {
  HIGH: 4,
  ELEVATED: 3,
  LOW: 2,
  SAFE: 1,
  NO_DATA: 0,
};

// 风险分级类型、标签与标准化评价文本见 ./loadConstants（纯前端安全，客户端可引用）
export type { AcwrRiskLevel } from './loadConstants';

export interface CreateLoadRecordInput {
  athleteId: number;
  recordDate: string; // YYYY-MM-DD
  rpe: number; // 自觉劳累程度 1-10
  durationMinutes: number; // 训练时长（分钟）
  trainingType?: string; // 训练类型：力量/速度/耐力/柔韧/技巧/恢复
  notes?: string;
}

export interface AthleteLoadOverview {
  athleteId: number;
  athleteName: string;
  dates: string[]; // 近 28 天日期（YYYY-MM-DD，旧 → 新）
  dailyLoads: number[]; // 对应每日训练量
  acuteLoad: number; // 急性负荷：近 7 天 EWMA
  chronicLoad: number; // 慢性负荷：近 28 天 EWMA
  acwr: number | null; // 急慢性负荷比（急性 EWMA / 慢性 EWMA）
  riskLevel: AcwrRiskLevel;
  recordCount: number; // 28 天窗口内记录条数
}

// ============================================================
// 日期工具（本地时区）
// ============================================================

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 将日期字符串转为当天 0 点（本地时区） */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 计算以今天为截止日的近 N 天窗口 [start, end] */
function buildWindow(days: number): { start: Date; end: Date; keys: string[] } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(localDateKey(d));
  }
  return { start, end, keys };
}

// ============================================================
// 负荷记录 CRUD
// ============================================================

export async function createLoadRecord(input: CreateLoadRecordInput, operatorId: number) {
  if (!input.athleteId) throw new BusinessError('ATHLETE_REQUIRED', '请选择运动员');
  if (!input.recordDate) throw new BusinessError('DATE_REQUIRED', '请选择训练日期');

  const rpe = Number(input.rpe);
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
    throw new BusinessError('INVALID_RPE', 'RPE 值必须为 1-10 的整数');
  }

  const duration = Number(input.durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new BusinessError('INVALID_DURATION', '训练时长必须大于 0 分钟');
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: input.athleteId } });
  if (!athlete) throw new BusinessError('ATHLETE_NOT_FOUND', '运动员不存在');

  const record = await prisma.loadRecord.create({
    data: {
      athleteId: input.athleteId,
      recordDate: parseDateKey(input.recordDate),
      rpe,
      durationMinutes: duration,
      trainingType: input.trainingType?.trim() || null,
      notes: input.notes?.trim() || null,
      recordedById: operatorId,
    },
    include: { athlete: { select: { id: true, name: true } } },
  });

  await logAction({
    userId: operatorId,
    action: 'CREATE_LOAD_RECORD',
    targetType: 'LoadRecord',
    targetId: record.id,
    detail: { athleteId: input.athleteId, rpe, durationMinutes: duration },
  });

  return record;
}

export async function listLoadRecords(params: {
  athleteId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { athleteId, startDate, endDate, page = 1, pageSize = 10 } = params;
  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = parseDateKey(startDate);
    if (endDate) {
      const end = parseDateKey(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.recordDate = dateFilter;
  }

  const [records, total] = await Promise.all([
    prisma.loadRecord.findMany({
      where,
      orderBy: { recordDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { athlete: { select: { id: true, name: true } } },
    }),
    prisma.loadRecord.count({ where }),
  ]);

  return { records, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============================================================
// 训练量与 ACWR 计算（EWMA）
// ============================================================

/**
 * 指数加权移动平均（EWMA）
 * 以窗口首个观测值初始化 EWMA，之后每日按 ewma = value × λ + ewma × (1 − λ) 递推。
 * 无训练记录的日子以 0 参与计算，EWMA 自然衰减，体现负荷随时间的遗忘。
 */
function computeEwma(values: number[], lambda: number): number {
  if (values.length === 0) return 0;
  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = values[i] * lambda + ewma * (1 - lambda);
  }
  return ewma;
}

function classifyAcwr(acwr: number | null): AcwrRiskLevel {
  if (acwr === null) return 'NO_DATA';
  if (acwr < ACWR_LOW_MAX) return 'LOW';
  if (acwr <= ACWR_SAFE_MAX) return 'SAFE';
  if (acwr <= ACWR_ELEVATED_MAX) return 'ELEVATED';
  return 'HIGH';
}

/**
 * 计算 ACWR（急性 EWMA / 慢性 EWMA）
 * 数据有效性校验：仅当急性/慢性负荷均为有限数值且慢性负荷 > 0 时返回比值（保留两位小数），否则返回 null
 */
export function computeAcwrRatio(acuteLoad: number, chronicLoad: number): number | null {
  if (!Number.isFinite(acuteLoad) || !Number.isFinite(chronicLoad)) return null;
  if (chronicLoad <= 0) return null;
  const acwr = acuteLoad / chronicLoad;
  if (!Number.isFinite(acwr) || acwr < 0) return null;
  return Math.round(acwr * 100) / 100;
}

/** 校验 ACWR 数值有效性：非空、有限且非负 */
export function validateAcwrValue(acwr: number | null): acwr is number {
  return acwr !== null && Number.isFinite(acwr) && acwr >= 0;
}

/**
 * 获取全队运动员负荷概览（近 28 天窗口，含 ACWR）
 */
export async function getLoadOverview(): Promise<AthleteLoadOverview[]> {
  const { start, end, keys } = buildWindow(ACWR_CHRONIC_DAYS);

  const records = await prisma.loadRecord.findMany({
    where: { recordDate: { gte: start, lte: end } },
    include: { athlete: { select: { id: true, name: true } } },
  });

  // 按运动员聚合每日负荷
  const byAthlete = new Map<number, { name: string; daily: Map<string, number>; count: number }>();
  for (const r of records) {
    // 数据校验：跳过非法训练量（非有限值或负数）的记录，保证 ACWR 计算输入有效
    const load = r.rpe * r.durationMinutes;
    if (!Number.isFinite(load) || load < 0) continue;
    const key = localDateKey(r.recordDate);
    let entry = byAthlete.get(r.athleteId);
    if (!entry) {
      entry = { name: r.athlete.name, daily: new Map(), count: 0 };
      byAthlete.set(r.athleteId, entry);
    }
    entry.daily.set(key, (entry.daily.get(key) ?? 0) + load);
    entry.count += 1;
  }

  const result: AthleteLoadOverview[] = [];
  for (const [athleteId, entry] of byAthlete) {
    const dailyLoads = keys.map((k) => entry.daily.get(k) ?? 0);
    // 急性/慢性负荷均采用 EWMA：急性用近 7 天（λ=0.25），慢性用近 28 天（λ=2/29）
    const acuteLoad = computeEwma(dailyLoads.slice(-ACWR_ACUTE_DAYS), EWMA_ACUTE_LAMBDA);
    const chronicLoad = computeEwma(dailyLoads, EWMA_CHRONIC_LAMBDA);
    const acwr = computeAcwrRatio(acuteLoad, chronicLoad);

    result.push({
      athleteId,
      athleteName: entry.name,
      dates: keys,
      dailyLoads,
      acuteLoad,
      chronicLoad,
      acwr,
      riskLevel: classifyAcwr(acwr),
      recordCount: entry.count,
    });
  }

  // 按 ACWR 降序排序（高风险优先），无数据排最后
  result.sort((a, b) => {
    if (a.acwr === null && b.acwr === null) return b.athleteName.localeCompare(a.athleteName, 'zh-CN');
    if (a.acwr === null) return 1;
    if (b.acwr === null) return -1;
    return b.acwr - a.acwr;
  });

  return result;
}

/**
 * 获取单个运动员近 28 天每日负荷明细（含 ACWR）
 */
export async function getAthleteLoadDetail(athleteId: number) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, name: true },
  });
  if (!athlete) throw new BusinessError('ATHLETE_NOT_FOUND', '运动员不存在');

  const { start, end, keys } = buildWindow(ACWR_CHRONIC_DAYS);
  const records = await prisma.loadRecord.findMany({
    where: { athleteId, recordDate: { gte: start, lte: end } },
    orderBy: { recordDate: 'asc' },
  });

  const daily = new Map<string, number>();
  for (const r of records) {
    const key = localDateKey(r.recordDate);
    daily.set(key, (daily.get(key) ?? 0) + r.rpe * r.durationMinutes);
  }

  const dailyLoads = keys.map((k) => daily.get(k) ?? 0);
  const acuteLoad = computeEwma(dailyLoads.slice(-ACWR_ACUTE_DAYS), EWMA_ACUTE_LAMBDA);
  const chronicLoad = computeEwma(dailyLoads, EWMA_CHRONIC_LAMBDA);
  const acwr = computeAcwrRatio(acuteLoad, chronicLoad);

  return {
    athlete,
    dates: keys,
    dailyLoads,
    acuteLoad,
    chronicLoad,
    acwr,
    riskLevel: classifyAcwr(acwr),
    recordCount: records.length,
  };
}

// ============================================================
// 风险预警摘要（数据看板）
// ============================================================

export interface AcwrRiskSummaryItem {
  athleteId: number;
  athleteName: string;
  acwr: number | null;
  acuteLoad: number;
  chronicLoad: number;
  riskLevel: AcwrRiskLevel;
}

/**
 * 获取全队 ACWR 风险预警摘要（供数据看板使用）
 * 排序规则：按风险优先级（HIGH > ELEVATED > LOW > SAFE > NO_DATA），同级按 ACWR 降序
 */
export async function getAcwrRiskSummary(limit = 5): Promise<AcwrRiskSummaryItem[]> {
  const overview = await getLoadOverview();
  return overview
    .map(({ athleteId, athleteName, acwr, acuteLoad, chronicLoad, riskLevel }) => ({
      athleteId,
      athleteName,
      acwr,
      acuteLoad,
      chronicLoad,
      riskLevel,
    }))
    .sort((a, b) => {
      const pa = RISK_PRIORITY[a.riskLevel];
      const pb = RISK_PRIORITY[b.riskLevel];
      if (pa !== pb) return pb - pa;
      return (b.acwr ?? -1) - (a.acwr ?? -1);
    })
    .slice(0, limit);
}
