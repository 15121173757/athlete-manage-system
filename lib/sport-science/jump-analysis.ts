/**
 * 跳跃分析计算模块 —— 视频跳跃生物力学分析工具
 *
 * 基于「飞行时间法」：跳跃高度 h = g·t²/8，起跳速度 v = g·t/2
 * （t 为腾空时间，g 为标准重力加速度 9.80665 m/s²）
 *
 * 本模块为纯函数计算，不依赖数据库，便于单元测试与前端复用。
 */

export const GRAVITY = 9.80665; // 标准重力加速度（m/s²）

export type JumpTestType = 'CMJ' | 'SJ' | 'DJ' | 'REPEAT_10_5';

export interface JumpTestTypeMeta {
  value: JumpTestType;
  label: string;
  short: string;
  desc: string;
}

export const JUMP_TEST_TYPES: JumpTestTypeMeta[] = [
  {
    value: 'CMJ',
    label: 'CMJ 下蹲跳',
    short: 'CMJ',
    desc: '下蹲（countermovement）后立即起跳，评估下肢爆发力与拉长-缩短周期（SSC）利用能力',
  },
  {
    value: 'SJ',
    label: 'SJ 静态蹲跳',
    short: 'SJ',
    desc: '静蹲约 2 秒后起跳（无预蹲反冲），评估纯向心爆发力',
  },
  {
    value: 'DJ',
    label: 'DJ 跳深',
    short: 'DJ',
    desc: '从跳箱落下触地后快速弹起，测量触地时间与反应力量指数（RSI）',
  },
  {
    value: 'REPEAT_10_5',
    label: '10-5 重复跳',
    short: '10-5',
    desc: '连续 10 次最大努力跳跃，评估连续弹跳能力与 RSI 稳定性',
  },
];

export function getJumpTestTypeMeta(type: string): JumpTestTypeMeta | undefined {
  return JUMP_TEST_TYPES.find((t) => t.value === type);
}

// ============================================================
// 单跳指标计算
// ============================================================

/** 保留两位小数（避免浮点误差，如 750×1.1=825.0000000001） */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 飞行时间（ms）→ 跳跃高度（cm）：h = g·t²/8 */
export function flightTimeToHeight(flightTimeMs: number): number {
  const t = flightTimeMs / 1000; // ms → s
  return (GRAVITY * t * t) / 8 * 100; // m → cm
}

/** 飞行时间（ms）→ 起跳速度（m/s）：v = g·t/2 */
export function flightTimeToTakeoffVelocity(flightTimeMs: number): number {
  return (GRAVITY * (flightTimeMs / 1000)) / 2;
}

/** 跳跃高度（cm）+ 触地时间（ms）→ 反应力量指数 RSI = 高度(m) / 触地时间(s) */
export function heightAndContactToRsi(jumpHeightCm: number, contactTimeMs: number): number {
  if (!Number.isFinite(contactTimeMs) || contactTimeMs <= 0) return NaN;
  return (jumpHeightCm / 100) / (contactTimeMs / 1000);
}

/**
 * 修正反应力量指数 RSI-mod = 高度(m) / 飞行时间(s)。
 *
 * 标准定义（Ebben & Petushek 2010；Suchomel et al. 2015；Sole et al. 2018）为
 * RSI-mod = 跳跃高度(m) / 离地时间(s)（time to take-off）。在连续弹跳（10-5）场景下，
 * 「离地时间」等于触地时间，与 RSI 数值重合，故本工具采用飞行时间归一化的实用变体
 * RSI-mod = 高度(m) / 飞行时间(s)（= g·t/8 = 起跳速度/2），适合仅有飞行/触地时间的
 * 视频飞行时间法分析，用于衡量「单位腾空时间产生的高度效率」。详见 docs/rsi-mod-methodology.md。
 */
export function heightAndFlightTimeToRsiMod(jumpHeightCm: number, flightTimeMs: number): number {
  if (!Number.isFinite(flightTimeMs) || flightTimeMs <= 0) return NaN;
  return (jumpHeightCm / 100) / (flightTimeMs / 1000);
}

export interface SingleJumpMetrics {
  /** 飞行时间（ms） */
  flightTimeMs: number;
  /** 跳跃高度（cm） */
  jumpHeightCm: number;
  /** 起跳速度（m/s） */
  takeoffVelocity: number;
  /** 触地时间（ms，DJ 等含触地测试使用；无则为 null） */
  contactTimeMs: number | null;
  /** 反应力量指数（需触地时间；无则为 null） */
  rsi: number | null;
  /** 修正反应力量指数 RSI-mod = 高度(m) / 飞行时间(s)，10-5 连续跳报告使用 */
  rsiMod: number | null;
}

/**
 * 计算单跳指标（SJ / CMJ / DJ 共用）。
 * @param flightTimeMs 飞行时间（ms，起跳离地 → 落地）
 * @param contactTimeMs 触地时间（ms，DJ 的落地→再次起跳；可空）
 */
export function computeSingleJumpMetrics(flightTimeMs: number, contactTimeMs?: number | null): SingleJumpMetrics {
  const height = flightTimeToHeight(flightTimeMs);
  const hasContact = contactTimeMs != null && Number.isFinite(contactTimeMs) && contactTimeMs >= 0;
  const rsi = hasContact && contactTimeMs! > 0 ? heightAndContactToRsi(height, contactTimeMs!) : null;
  const rsiMod = heightAndFlightTimeToRsiMod(height, flightTimeMs);
  return {
    flightTimeMs: round2(flightTimeMs),
    jumpHeightCm: round2(height),
    takeoffVelocity: round2(flightTimeToTakeoffVelocity(flightTimeMs)),
    contactTimeMs: hasContact ? contactTimeMs! : null,
    rsi: rsi != null && Number.isFinite(rsi) ? round2(rsi) : null,
    rsiMod: rsiMod != null && Number.isFinite(rsiMod) ? round2(rsiMod) : null,
  };
}

// ============================================================
// 10-5 重复跳汇总
// ============================================================

export interface RepeatJumpDatum {
  /** 第几次跳跃（从 1 开始） */
  index: number;
  /** 本次飞行时间（ms） */
  flightTimeMs: number;
  /** 本次跳跃高度（cm） */
  jumpHeightCm: number;
  /** 本次触地时间（ms，与下一次起跳之间的接地时间；最后一次可为空） */
  contactTimeMs: number | null;
  /** 本次 RSI（需触地时间） */
  rsi: number | null;
  /** 本次 RSI-mod（= 高度(m) / 飞行时间(s)） */
  rsiMod: number | null;
}

export interface RepeatJumpSummary {
  /** 有效跳跃次数 */
  jumpCount: number;
  /** 平均高度（cm） */
  avgHeightCm: number;
  /** 最佳高度（cm） */
  bestHeightCm: number;
  /** 平均 RSI */
  avgRsi: number | null;
  /** RSI 变异系数（% = SD/Mean×100，评估跳跃稳定性） */
  rsiCv: number | null;
  /** 平均 RSI-mod */
  avgRsiMod: number | null;
  /** RSI-mod 变异系数（% = SD/Mean×100） */
  rsiModCv: number | null;
}

/** 计算一组数值的标准差（样本，n-1；n<2 时为 0） */
function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * 汇总 10-5 重复跳：传入逐跳飞行时间与触地时间，
 * 返回平均/最佳高度、平均 RSI 与 RSI 变异系数、平均 RSI-mod 与 RSI-mod 变异系数。
 */
export function summarizeRepeatJumps(items: { flightTimeMs: number; contactTimeMs?: number | null }[]): RepeatJumpSummary {
  const details: RepeatJumpDatum[] = items.map((it, i) => {
    const metrics = computeSingleJumpMetrics(it.flightTimeMs, it.contactTimeMs);
    return {
      index: i + 1,
      flightTimeMs: metrics.flightTimeMs,
      jumpHeightCm: metrics.jumpHeightCm,
      contactTimeMs: metrics.contactTimeMs,
      rsi: metrics.rsi,
      rsiMod: metrics.rsiMod,
    };
  });

  const heights = details.map((d) => d.jumpHeightCm);
  const rsis = details.map((d) => d.rsi).filter((v): v is number => v != null);
  const rsiMods = details.map((d) => d.rsiMod).filter((v): v is number => v != null);

  const meanOf = (vals: number[]) => (vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0);
  const cvOf = (vals: number[]) =>
    vals.length >= 2 && meanOf(vals) !== 0 ? round2((sampleStd(vals) / meanOf(vals)) * 100) : null;

  return {
    jumpCount: details.length,
    avgHeightCm: round2(meanOf(heights)),
    bestHeightCm: round2(Math.max(...heights, 0)),
    avgRsi: rsis.length > 0 ? round2(meanOf(rsis)) : null,
    rsiCv: cvOf(rsis),
    avgRsiMod: rsiMods.length > 0 ? round2(meanOf(rsiMods)) : null,
    rsiModCv: cvOf(rsiMods),
  };
}

// ============================================================
// 帧/时间换算（逐帧标记辅助）
// ============================================================

/** 帧序号 → 时间（ms） */
export function frameToTimeMs(frameIndex: number, fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return (frameIndex / fps) * 1000;
}

/** 时间（ms）→ 最近帧序号 */
export function timeToFrameIndex(timeMs: number, fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return Math.round((timeMs / 1000) * fps);
}

/** 根据视频时长与帧率推算总帧数（用于帧步进上限） */
export function durationToFrameCount(durationMs: number, fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return Math.floor((durationMs / 1000) * fps);
}
