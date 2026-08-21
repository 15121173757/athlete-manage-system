/**
 * 体能测试计划状态判定 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 统一使用北京时间（Asia/Shanghai，UTC+8）作为时间基准
 * 2. 依据「执行时间（测试日期 + 开始时间，精确到分钟）」与「当前北京时间」的关系判定状态：
 *    - 已执行（COMPLETED）：执行时间早于或等于当前时间
 *    - 待执行（SCHEDULED）：执行时间晚于当前时间
 *    - 草稿（DRAFT）：不参与自动判定，仅在显式发布后进入执行序列
 * 3. 提供批量/单条状态刷新，供定时任务与列表/详情查看时调用
 */

import { prisma } from '@/lib/db/prisma';
import { logAction } from '@/lib/modules/audit/AuditService';

export type FitnessExecStatus = 'SCHEDULED' | 'COMPLETED';

/** 北京时间相对 UTC 的偏移（毫秒） */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 将 testDate（Date 或 'YYYY-MM-DD' 字符串）归一化为 'YYYY-MM-DD' 日期串 */
function normalizeDateStr(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) {
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/**
 * 判定非草稿计划应处于的状态。
 * 执行时间以北京时间墙钟（+08:00）解析为绝对时间戳后，与当前绝对时间戳比较，
 * 两者均为绝对 epoch，比较结果天然不受服务器所在时区影响。
 * 精确到分钟：执行时间 >= 当前时间 → COMPLETED（已执行），否则 → SCHEDULED（待执行）。
 */
export function resolveFitnessPlanExecStatus(
  testDate: Date | string | null | undefined,
  startTime: string | null | undefined,
  nowMs: number = Date.now()
): FitnessExecStatus {
  const dateStr = normalizeDateStr(testDate);
  if (!dateStr || !startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    // 缺少执行时间无法判定，默认视为待执行（发布时会先行校验完整性）
    return 'SCHEDULED';
  }
  const execMs = Date.parse(`${dateStr}T${startTime}:00+08:00`);
  if (Number.isNaN(execMs)) return 'SCHEDULED';

  const nowMin = Math.floor(nowMs / 60000) * 60000;
  const execMin = Math.floor(execMs / 60000) * 60000;
  return nowMin >= execMin ? 'COMPLETED' : 'SCHEDULED';
}

/** 当前北京时间（用于展示/调试，返回与 +08:00 对应的 Date 对象） */
export function getBeijingNow(): Date {
  return new Date(Date.now() + BEIJING_OFFSET_MS);
}

interface StatusPlanRow {
  id: number;
  createdById: number;
  status: string;
  testDate: Date | null;
  startTime: string | null;
}

/**
 * 刷新单条计划状态（草稿不参与）。
 * 若状态发生变更，写入审计日志（记录前后值、操作人、触发来源）。
 * @returns 最终状态
 */
async function refreshFitnessPlanStatus(
  plan: StatusPlanRow,
  trigger: string,
  operatorId?: number
): Promise<string> {
  if (plan.status === 'DRAFT') return plan.status;

  const target = resolveFitnessPlanExecStatus(plan.testDate, plan.startTime);
  if (plan.status === target) return plan.status;

  await prisma.fitnessTestPlan.update({
    where: { id: plan.id },
    data: { status: target },
  });

  await logAction({
    // 系统自动刷新无登录用户，回退为计划创建人作为责任操作人，并在 detail 标注来源
    userId: operatorId ?? plan.createdById,
    action: 'FITNESS_PLAN_STATUS_CHANGE',
    targetType: 'FitnessTestPlan',
    targetId: plan.id,
    detail: { before: plan.status, after: target, trigger },
  });

  return target;
}

/** 批量刷新所有非草稿计划（供定时任务与列表查看时调用），返回发生变更的计划数 */
export async function refreshAllFitnessPlanStatuses(): Promise<number> {
  const plans = await prisma.fitnessTestPlan.findMany({
    where: { status: { notIn: ['DRAFT'] } },
    select: { id: true, createdById: true, status: true, testDate: true, startTime: true },
  });

  let changed = 0;
  for (const p of plans) {
    const before = p.status;
    const after = await refreshFitnessPlanStatus(p, 'AUTO');
    if (before !== after) changed += 1;
  }
  return changed;
}

/** 刷新单条计划状态（供详情查看时调用） */
export async function refreshFitnessPlanStatusById(id: number): Promise<void> {
  const plan = await prisma.fitnessTestPlan.findUnique({
    where: { id },
    select: { id: true, createdById: true, status: true, testDate: true, startTime: true },
  });
  if (plan) await refreshFitnessPlanStatus(plan, 'VIEW');
}
