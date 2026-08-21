/**
 * 跳跃分析业务服务 —— 视频跳跃生物力学分析工具
 *
 * 职责：
 * 1. 保存视频分析出的跳跃测试结果（单跳 / 10-5 重复跳）
 * 2. 按运动员 / 日期范围 / 测试类型查询历史记录
 * 3. 删除记录
 * 派生指标（跳跃高度、起跳速度、RSI、10-5 汇总）统一由服务端计算，不信任前端传入值
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError, NotFoundError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';
import {
  GRAVITY,
  computeSingleJumpMetrics,
  flightTimeToHeight,
  flightTimeToTakeoffVelocity,
  getJumpTestTypeMeta,
  summarizeRepeatJumps,
  type JumpTestType,
  type RepeatJumpDatum,
} from '@/lib/sport-science/jump-analysis';

// ============================================================
// 日期工具
// ============================================================

/** 'YYYY-MM-DD' → 当天本地时区零点（与负荷监控模块 LoadService.parseDateKey 一致） */
function localMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Date → 'YYYY-MM-DD'（本地时区，与存储语义对称） */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ============================================================
// 类型定义
// ============================================================

export interface CreateJumpAnalysisInput {
  athleteId: number;
  testType: JumpTestType;
  /** 测试日期 YYYY-MM-DD */
  testDate: string;
  videoName?: string | null;
  /** 视频帧率（标记精度依据，用于展示） */
  videoFps?: number | null;
  /** 飞行时间（ms，单跳必填；10-5 由 details 汇总） */
  flightTimeMs?: number | null;
  /** 触地时间（ms，DJ / 10-5 使用） */
  contactTimeMs?: number | null;
  /** 下落高度（cm，DJ 跳深测试的跳箱高度；其他类型忽略） */
  dropHeightCm?: number | null;
  /** 逐跳明细（index 从 1 开始；派生值由服务端重算，仅需时间字段）。10-5 必填；单跳多跳（CMJ/SJ/DJ 连续 1-3 次）时提供则按多次跳跃处理 */
  details?: { index: number; flightTimeMs: number; contactTimeMs?: number | null }[];
  notes?: string | null;
}

export interface JumpAnalysisQuery {
  athleteId?: number;
  /** 起始日期 YYYY-MM-DD（含） */
  startDate?: string;
  /** 结束日期 YYYY-MM-DD（含） */
  endDate?: string;
  testType?: string;
  /** 返回条数上限 */
  limit?: number;
}

export interface JumpAnalysisListItem {
  id: number;
  athleteId: number;
  athleteName: string;
  athleteSport: string;
  testType: string;
  testDate: string;
  videoName: string | null;
  videoFps: number | null;
  flightTimeMs: number | null;
  jumpHeightCm: number | null;
  takeoffVelocity: number | null;
  contactTimeMs: number | null;
  rsi: number | null;
  dropHeightCm: number | null;
  jumpCount: number | null;
  avgHeightCm: number | null;
  bestHeightCm: number | null;
  avgRsi: number | null;
  rsiCv: number | null;
  details: RepeatJumpDatum[];
  notes: string | null;
  createdAt: string;
}

// ============================================================
// 数据校验
// ============================================================

/** 飞行时间合理范围（ms）：约 5cm 至 2m 跳跃对应范围 */
const MIN_FLIGHT_TIME_MS = 100;
const MAX_FLIGHT_TIME_MS = 3000;

function validateSingleJump(testType: JumpTestType, flightTimeMs: number | null | undefined, contactTimeMs: number | null | undefined) {
  if (testType === 'REPEAT_10_5') return;
  if (flightTimeMs == null) throw new BusinessError('VALIDATION_ERROR', '请填写飞行时间（起跳至落地）');
  if (!Number.isFinite(flightTimeMs) || flightTimeMs < MIN_FLIGHT_TIME_MS || flightTimeMs > MAX_FLIGHT_TIME_MS) {
    throw new BusinessError('VALIDATION_ERROR', `飞行时间需在 ${MIN_FLIGHT_TIME_MS}-${MAX_FLIGHT_TIME_MS}ms 之间`);
  }
  if (contactTimeMs != null && (!Number.isFinite(contactTimeMs) || contactTimeMs < 0)) {
    throw new BusinessError('VALIDATION_ERROR', '触地时间不能为负数');
  }
}

function validateRepeatJumps(
  details: { index: number; flightTimeMs: number; contactTimeMs?: number | null }[] | undefined | null
) {
  if (!details || details.length === 0) {
    throw new BusinessError('VALIDATION_ERROR', '10-5 重复跳至少需要标记 1 次跳跃');
  }
  if (details.length > 20) {
    throw new BusinessError('VALIDATION_ERROR', '单次测试跳跃次数不能超过 20 次');
  }
  for (const d of details) {
    if (!Number.isFinite(d.flightTimeMs) || d.flightTimeMs < MIN_FLIGHT_TIME_MS || d.flightTimeMs > MAX_FLIGHT_TIME_MS) {
      throw new BusinessError('VALIDATION_ERROR', `第 ${d.index} 次跳跃的飞行时间需在 ${MIN_FLIGHT_TIME_MS}-${MAX_FLIGHT_TIME_MS}ms 之间`);
    }
    if (d.contactTimeMs != null && (!Number.isFinite(d.contactTimeMs) || d.contactTimeMs < 0)) {
      throw new BusinessError('VALIDATION_ERROR', `第 ${d.index} 次跳跃的触地时间不能为负数`);
    }
  }
}

// ============================================================
// 核心业务
// ============================================================

export async function createJumpAnalysis(input: CreateJumpAnalysisInput, operatorId: number) {
  const meta = getJumpTestTypeMeta(input.testType);
  if (!meta) throw new BusinessError('VALIDATION_ERROR', '未知的测试类型');

  if (!Number.isInteger(input.athleteId) || input.athleteId <= 0) {
    throw new BusinessError('VALIDATION_ERROR', '运动员 ID 必须为正整数');
  }
  const athlete = await prisma.athlete.findUnique({ where: { id: input.athleteId } });
  if (!athlete) throw new NotFoundError('运动员不存在');

  const date = new Date(input.testDate);
  if (isNaN(date.getTime())) throw new BusinessError('VALIDATION_ERROR', '测试日期格式不正确');

  // 下落高度（DJ 参数）：若提供则必须为 1-200cm 之间的整数
  if (input.dropHeightCm != null) {
    if (!Number.isInteger(input.dropHeightCm) || input.dropHeightCm < 1 || input.dropHeightCm > 200) {
      throw new BusinessError('VALIDATION_ERROR', '下落高度需为 1-200cm 之间的整数');
    }
  }

  // 单跳 / 10-5 分别校验
  let flightTimeMs: number | null = null;
  let contactTimeMs: number | null = null;
  let jumpHeightCm: number | null = null;
  let takeoffVelocity: number | null = null;
  let rsi: number | null = null;
  let jumpCount: number | null = null;
  let avgHeightCm: number | null = null;
  let bestHeightCm: number | null = null;
  let avgRsi: number | null = null;
  let rsiCv: number | null = null;
  let details: RepeatJumpDatum[] = [];

  if (input.testType === 'REPEAT_10_5') {
    validateRepeatJumps(input.details);
    // 明细派生值统一由服务端重算，不信任前端传入
    details = input.details!.map((d) => {
      const m = computeSingleJumpMetrics(d.flightTimeMs, d.contactTimeMs);
      return {
        index: d.index,
        flightTimeMs: m.flightTimeMs,
        jumpHeightCm: m.jumpHeightCm,
        contactTimeMs: m.contactTimeMs,
        rsi: m.rsi,
        rsiMod: m.rsiMod,
      };
    });
    const summary = summarizeRepeatJumps(details);
    jumpCount = summary.jumpCount;
    avgHeightCm = summary.avgHeightCm;
    bestHeightCm = summary.bestHeightCm;
    avgRsi = summary.avgRsi;
    rsiCv = summary.rsiCv;
  } else {
    validateSingleJump(input.testType, input.flightTimeMs, input.contactTimeMs);
    // 单次视频连续多次跳跃（CMJ/SJ/DJ 各 1-3 次）：details 提供每次的飞行/触地时间
    if (input.details && input.details.length > 0) {
      validateRepeatJumps(input.details);
      const perJump = input.details.map((d) => {
        const m = computeSingleJumpMetrics(d.flightTimeMs, d.contactTimeMs);
        return {
          index: d.index,
          flightTimeMs: m.flightTimeMs,
          jumpHeightCm: m.jumpHeightCm,
          takeoffVelocity: m.takeoffVelocity,
          contactTimeMs: m.contactTimeMs,
          rsi: m.rsi,
          rsiMod: m.rsiMod,
        };
      });
      // 主指标字段存「最佳高度」那一跳，便于历史列表/趋势直接展示最佳成绩
      const best = perJump.reduce((a, b) => (b.jumpHeightCm > a.jumpHeightCm ? b : a));
      flightTimeMs = best.flightTimeMs;
      jumpHeightCm = best.jumpHeightCm;
      takeoffVelocity = best.takeoffVelocity;
      contactTimeMs = best.contactTimeMs;
      rsi = best.rsi;
      jumpCount = perJump.length;
      details = perJump;
      const summary = summarizeRepeatJumps(perJump);
      avgHeightCm = summary.avgHeightCm;
      bestHeightCm = summary.bestHeightCm;
      avgRsi = summary.avgRsi;
      rsiCv = summary.rsiCv;
    } else {
      flightTimeMs = input.flightTimeMs!;
      contactTimeMs = input.contactTimeMs ?? null;
      const metrics = computeSingleJumpMetrics(flightTimeMs, contactTimeMs);
      jumpHeightCm = metrics.jumpHeightCm;
      takeoffVelocity = metrics.takeoffVelocity;
      rsi = metrics.rsi;
    }
  }

  const record = await prisma.jumpAnalysisRecord.create({
    data: {
      athleteId: input.athleteId,
      testType: input.testType,
      testDate: localMidnight(input.testDate),
      videoName: input.videoName ?? null,
      videoFps: input.videoFps ?? null,
      flightTimeMs,
      jumpHeightCm,
      takeoffVelocity,
      contactTimeMs,
      rsi,
      dropHeightCm: input.testType === 'DJ' ? input.dropHeightCm ?? null : null,
      jumpCount,
      avgHeightCm,
      bestHeightCm,
      avgRsi,
      rsiCv,
      details: JSON.stringify(details),
      notes: input.notes ?? null,
      recordedById: operatorId,
    },
  });

  await logAction({
    userId: operatorId,
    action: 'CREATE_JUMP_ANALYSIS',
    targetType: 'JumpAnalysisRecord',
    targetId: record.id,
    detail: { athleteId: input.athleteId, testType: input.testType, testDate: input.testDate },
  });

  return record;
}

export async function listJumpAnalysis(query: JumpAnalysisQuery): Promise<JumpAnalysisListItem[]> {
  const where: Record<string, unknown> = {};
  if (query.athleteId) where.athleteId = query.athleteId;
  if (query.testType) where.testType = query.testType;
  if (query.startDate || query.endDate) {
    const range: Record<string, Date> = {};
    if (query.startDate) range.gte = localMidnight(query.startDate);
    if (query.endDate) range.lte = new Date(localMidnight(query.endDate).getTime() + 86399999);
    where.testDate = range;
  }

  const rows = await prisma.jumpAnalysisRecord.findMany({
    where,
    include: { athlete: { select: { id: true, name: true, sport: true } } },
    orderBy: [{ testDate: 'desc' }, { id: 'desc' }],
    take: query.limit && query.limit > 0 ? Math.min(query.limit, 500) : 100,
  });

  return rows.map((r) => ({
    id: r.id,
    athleteId: r.athleteId,
    athleteName: r.athlete.name,
    athleteSport: r.athlete.sport,
    testType: r.testType,
    testDate: toLocalDateStr(r.testDate),
    videoName: r.videoName,
    videoFps: r.videoFps,
    flightTimeMs: r.flightTimeMs,
    jumpHeightCm: r.jumpHeightCm,
    takeoffVelocity: r.takeoffVelocity,
    contactTimeMs: r.contactTimeMs,
    rsi: r.rsi,
    dropHeightCm: r.dropHeightCm,
    jumpCount: r.jumpCount,
    avgHeightCm: r.avgHeightCm,
    bestHeightCm: r.bestHeightCm,
    avgRsi: r.avgRsi,
    rsiCv: r.rsiCv,
    details: JSON.parse(r.details || '[]'),
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteJumpAnalysis(id: number, operatorId: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new BusinessError('VALIDATION_ERROR', '记录 ID 必须为正整数');
  }
  const existing = await prisma.jumpAnalysisRecord.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('跳跃分析记录不存在');

  await prisma.jumpAnalysisRecord.delete({ where: { id } });
  await logAction({
    userId: operatorId,
    action: 'DELETE_JUMP_ANALYSIS',
    targetType: 'JumpAnalysisRecord',
    targetId: id,
    detail: { athleteId: existing.athleteId, testType: existing.testType },
  });
}

/** 供统计趋势使用的辅助导出（导出 GRAVITY 常量便于测试引用） */
export const JUMP_GRAVITY = GRAVITY;
export { flightTimeToHeight, flightTimeToTakeoffVelocity };
