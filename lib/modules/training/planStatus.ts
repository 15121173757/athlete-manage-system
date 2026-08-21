/**
 * 训练计划状态判定 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 统一使用北京时间（Asia/Shanghai，UTC+8）作为时间基准
 * 2. 依据「执行时间（精确到分钟）」与「当前北京时间」的关系判定状态：
 *    - 已执行（COMPLETED）：执行时间早于或等于当前时间
 *    - 待执行（SCHEDULED）：执行时间晚于当前时间
 *    - 草稿（DRAFT）：不参与自动判定，仅在显式发布后进入执行序列
 * 3. 提供批量/单条状态刷新，供定时任务与列表/详情查看时调用
 */

import { prisma } from '@/lib/db/prisma';
import { logAction } from '@/lib/modules/audit/AuditService';
import { updatePBOnRecord, calculatePBValue } from '@/lib/modules/pb/PBService';

export type ExecStatus = 'SCHEDULED' | 'COMPLETED';

/** 北京时间相对 UTC 的偏移（毫秒） */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 将 startDate（Date 或 'YYYY-MM-DD' 字符串）归一化为 'YYYY-MM-DD' 日期串 */
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
export function resolvePlanExecStatus(
  startDate: Date | string | null | undefined,
  startTime: string | null | undefined,
  nowMs: number = Date.now()
): ExecStatus {
  const dateStr = normalizeDateStr(startDate);
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
  coachId: number;
  status: string;
  startDate: Date | null;
  startTime: string | null;
}

/**
 * 刷新单条计划状态（草稿不参与）。
 * 若状态发生变更，写入审计日志（记录前后值、操作人、触发来源）。
 * @returns 最终状态
 */
async function refreshPlanStatus(
  plan: StatusPlanRow,
  trigger: string,
  operatorId?: number
): Promise<string> {
  if (plan.status === 'DRAFT') return plan.status;

  const target = resolvePlanExecStatus(plan.startDate, plan.startTime);
  if (plan.status === target) return plan.status;

  await prisma.trainingPlan.update({
    where: { id: plan.id },
    data: { status: target },
  });

  // 计划由「待执行」变为「已执行」时，自动记录完成数据并同步 PB；
  // 同步失败不阻断状态更新（记录日志便于排查）
  if (plan.status === 'SCHEDULED' && target === 'COMPLETED') {
    try {
      await syncCompletedPlanRecords(plan.id, operatorId ?? plan.coachId);
    } catch (error) {
      console.error(`[planStatus] 计划 ${plan.id} 完成数据自动记录失败`, error);
    }
  }

  await logAction({
    // 系统自动刷新无登录用户，回退为计划创建教练作为责任操作人，并在 detail 标注来源
    userId: operatorId ?? plan.coachId,
    action: 'PLAN_STATUS_CHANGE',
    targetType: 'TrainingPlan',
    targetId: plan.id,
    detail: { before: plan.status, after: target, trigger },
  });

  return target;
}

// ============================================================
// 计划完成自动记录（同步 PB 追踪）
// ============================================================

/**
 * 计划执行完成后自动生成训练记录并同步 PB。
 * 为该计划下每个关联运动员 × 每个练习项生成一条训练记录，
 * 实际值取自计划预设（组数/次数/负荷），并触发 PB 自动更新。
 * 跳过 PB 追踪字段无有效值的练习（如重量类未填负荷），避免生成 value=0 的无效 PB。
 * @returns 生成的训练记录条数
 */
export async function syncCompletedPlanRecords(
  planId: number,
  operatorId: number
): Promise<number> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    include: {
      items: true,
      planAthletes: { select: { athleteId: true } },
    },
  });
  if (!plan) return 0;

  const athleteIds = plan.planAthletes.map((pa) => pa.athleteId);
  if (athleteIds.length === 0 || plan.items.length === 0) return 0;

  // 幂等保护：该计划已有自动生成的训练记录时直接跳过，
  // 保证状态刷新、手动补录、重复调用均只生效一次，避免重复数据
  const existingAutoRecords = await prisma.trainingRecord.count({
    where: {
      planItemId: { in: plan.items.map((i) => i.id) },
      notes: { startsWith: '计划完成自动记录' },
    },
  });
  if (existingAutoRecords > 0) return 0;

  // 计划执行时间：startDate（UTC 零点）+ startTime（北京时间）→ 绝对时间戳
  const dateStr = normalizeDateStr(plan.startDate);
  const execAt =
    dateStr && plan.startTime && /^\d{2}:\d{2}$/.test(plan.startTime)
      ? new Date(Date.parse(`${dateStr}T${plan.startTime}:00+08:00`))
      : (plan.startDate ?? new Date(plan.createdAt));

  let created = 0;
  for (const item of plan.items) {
    const exercise = await prisma.exercise.findUnique({
      where: { id: item.exerciseId },
    });
    if (!exercise || !exercise.isPBTrackable) continue;

    const pbValue = calculatePBValue(
      {
        actualSets: item.sets,
        actualReps: item.reps,
        actualLoad: item.load,
        metricValue: null,
      },
      exercise.trackType
    );
    if (!(pbValue > 0)) continue;

    // 多运动员独立配置：练习项指定了运动员时仅给该运动员生成记录；
    // 未指定（共享配置）时给计划内全部运动员生成
    const targetAthleteIds = item.athleteId != null ? [item.athleteId] : athleteIds;

    for (const athleteId of targetAthleteIds) {
      const record = await prisma.trainingRecord.create({
        data: {
          athleteId,
          planItemId: item.id,
          exerciseId: item.exerciseId,
          actualSets: item.sets,
          actualReps: item.reps,
          actualLoad: item.load,
          metricValue: null,
          trainingDate: execAt,
          notes: item.notes ? `计划完成自动记录：${item.notes}` : '计划完成自动记录',
          recordedById: operatorId,
        },
      });
      await updatePBOnRecord(record);
      created += 1;
    }
  }

  if (created > 0) {
    await logAction({
      userId: operatorId,
      action: 'AUTO_SYNC_PLAN_RECORDS',
      targetType: 'TrainingPlan',
      targetId: planId,
      detail: { recordsCreated: created, athletes: athleteIds.length, items: plan.items.length },
    });
  }
  return created;
}

/** 批量刷新所有非草稿计划（供定时任务与列表/今日计划查看时调用），返回发生变更的计划数 */
export async function refreshAllPlanStatuses(): Promise<number> {
  const plans = await prisma.trainingPlan.findMany({
    where: { status: { not: 'DRAFT' } },
    select: { id: true, coachId: true, status: true, startDate: true, startTime: true },
  });

  let changed = 0;
  for (const p of plans) {
    const before = p.status;
    const after = await refreshPlanStatus(p, 'AUTO');
    if (before !== after) changed += 1;
  }
  return changed;
}

/** 刷新单条计划状态（供详情查看时调用） */
export async function refreshPlanStatusById(id: number): Promise<void> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id },
    select: { id: true, coachId: true, status: true, startDate: true, startTime: true },
  });
  if (plan) await refreshPlanStatus(plan, 'VIEW');
}
