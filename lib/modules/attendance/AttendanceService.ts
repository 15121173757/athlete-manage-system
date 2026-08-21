/**
 * 出勤管理业务服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 根据每日训练计划参训名单自动生成出勤表
 * 2. 支持手动添加额外参训人员
 * 3. 出勤状态记录的新增 / 更新 / 删除
 * 4. 按个人维度 / 团队维度生成出勤报告（含时间范围筛选）
 */

import { prisma } from '@/lib/db/prisma';
import { BusinessError, NotFoundError } from '@/lib/errors/ErrorPresenter';
import { logAction } from '@/lib/modules/audit/AuditService';
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatusCode,
} from '@/lib/attendance/attendance-types';

// ============================================================
// 日期工具
// ============================================================

/** 星期几（1=周一 ... 7=周日），使用 UTC 与日期串（YYYY-MM-DD）保持一致 */
function getDayOfWeek(date: Date): number {
  const d = date.getUTCDay(); // 0=周日 ... 6=周六
  return d === 0 ? 7 : d;
}

/** 'YYYY-MM-DD' → UTC 零点 Date */
function parseDateOnly(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new BusinessError('VALIDATION_ERROR', '日期格式不正确');
  return d;
}

/** Date → 'YYYY-MM-DD'（UTC） */
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 日期的次日零点（用于范围查询的右开区间） */
function nextDay(dateStr: string): Date {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * 'YYYY-MM-DD' → 当天本地时区零点
 * 与负荷监控模块（LoadService.parseDateKey）保持一致，确保出勤与负荷记录按同一天匹配
 */
function localMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 构建 [startDate, endDate] 之间的日期列表 */
function buildDateList(startDate: string, endDate: string): { dateStr: string; dayOfWeek: number }[] {
  const list: { dateStr: string; dayOfWeek: number }[] = [];
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    list.push({ dateStr: toDateStr(cur), dayOfWeek: getDayOfWeek(cur) });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return list;
}

// ============================================================
// 类型定义
// ============================================================

/** 出勤表单行 */
export interface AttendanceSheetRow {
  athleteId: number;
  name: string;
  sport: string;
  position: string | null;
  /** 来源：PLAN（计划自动生成）/ MANUAL（手动添加） */
  source: 'PLAN' | 'MANUAL';
  /** 当日关联的训练计划数（手动添加为 0） */
  planCount: number;
  status: AttendanceStatusCode | null;
  /** 自觉劳累程度（1-10，null 表示未填写） */
  rpe: number | null;
  /** 训练时长（分钟，null 表示未填写） */
  durationMinutes: number | null;
  /** 训练负荷（= RPE × 训练时长，任一为空时为 null） */
  load: number | null;
  notes: string | null;
}

export interface AttendanceSheet {
  date: string;
  dayOfWeek: number;
  rows: AttendanceSheetRow[];
  /** 可用于手动添加的运动员（已在出勤表中的排除） */
  availableAthletes: { id: number; name: string; sport: string }[];
}

export interface AttendanceStatusCount {
  status: AttendanceStatusCode;
  label: string;
  color: string;
  count: number;
  /** 占比（0-100，保留 1 位小数），基于已标记总数 */
  percentage: number;
}

export interface AttendanceScheduleCell {
  date: string;
  dayOfWeek: number;
  /** 该日是否有训练计划安排 */
  scheduled: boolean;
  status: AttendanceStatusCode | null;
}

export interface IndividualAttendanceReport {
  dimension: 'individual';
  athlete: { id: number; name: string; sport: string };
  range: { startDate: string; endDate: string };
  /** 个人训练计划总份数（同一天多份计划分别计数） */
  totalPlans: number;
  /** 训练天数（范围内有训练安排的去重天数） */
  planCount: number;
  /** 已标记出勤的总次数 */
  markedCount: number;
  /** 有计划但尚未标记的天数 */
  unmarkedCount: number;
  statusCounts: AttendanceStatusCount[];
  /** 日程标注（范围内每一天） */
  schedule: AttendanceScheduleCell[];
}

export interface TeamMemberRow {
  athleteId: number;
  name: string;
  sport: string;
  planCount: number;
  markedCount: number;
  statusCounts: AttendanceStatusCount[];
}

export interface TeamAttendanceReport {
  dimension: 'team';
  range: { startDate: string; endDate: string };
  /** 筛选的运动项目（null 表示全部项目） */
  sport: string | null;
  /** 队伍训练计划总数（所有队员计划次数之和） */
  planCount: number;
  markedCount: number;
  unmarkedCount: number;
  statusCounts: AttendanceStatusCount[];
  members: TeamMemberRow[];
}

export type AttendanceReport = IndividualAttendanceReport | TeamAttendanceReport;

// ============================================================
// 内部工具
// ============================================================

/** 将记录数组聚合为 6 种状态的计数（保持固定顺序，缺项为 0） */
function aggregateStatus(records: { status: string }[]): AttendanceStatusCount[] {
  const countMap = new Map<string, number>();
  for (const r of records) {
    countMap.set(r.status, (countMap.get(r.status) ?? 0) + 1);
  }
  const total = records.length;
  return ATTENDANCE_STATUSES.map((s) => {
    const count = countMap.get(s.code) ?? 0;
    return {
      status: s.code,
      label: s.label,
      color: s.color,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

/** 获取每个运动员「有训练安排的具体日期」集合（排除草稿，含待执行与已执行，YYYY-MM-DD） */
async function getScheduledDatesMap(): Promise<Map<number, Set<string>>> {
  const pairs = await prisma.trainingPlanAthlete.findMany({
    where: {
      plan: { status: { in: ['SCHEDULED', 'COMPLETED'] }, startDate: { not: null } },
    },
    include: { plan: { select: { startDate: true } } },
  });

  const map = new Map<number, Set<string>>();
  for (const p of pairs) {
    if (!p.plan.startDate) continue;
    const set = map.get(p.athleteId) ?? new Set<string>();
    set.add(toDateStr(p.plan.startDate));
    map.set(p.athleteId, set);
  }
  return map;
}

// ============================================================
// 出勤表：查询
// ============================================================

/**
 * 生成某日的出勤表：自动带出该日有训练计划的运动员，并合并已有的出勤记录
 * （手动添加的额外人员 = 有出勤记录但不在当日计划名单中的运动员）
 */
export async function listAttendanceSheet(dateStr: string): Promise<AttendanceSheet> {
  const date = parseDateOnly(dateStr);
  const dayOfWeek = getDayOfWeek(date);

  // 1. 当日有训练计划的运动员（计划执行开始日期按「日」匹配；排除草稿，含待执行与已执行）
  //    使用范围匹配 [date, nextDay) 而非精确相等，兼容 startDate 非 UTC 零点（带时分秒）的存量数据，
  //    否则此类计划即使已执行且关联运动员，也不会出现在任何日期的出勤表中
  const pairs = await prisma.trainingPlanAthlete.findMany({
    where: {
      plan: {
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        startDate: { gte: date, lt: nextDay(dateStr) },
      },
    },
    include: {
      athlete: { select: { id: true, name: true, sport: true, position: true } },
    },
  });

  // 2. 当日的出勤记录
  const records = await prisma.attendanceRecord.findMany({
    where: { attendanceDate: { gte: date, lt: nextDay(dateStr) } },
  });

  const recordByAthlete = new Map<number, (typeof records)[number]>();
  for (const r of records) recordByAthlete.set(r.athleteId, r);

  // 3. 组装出勤表行（先放计划名单，再放手动添加）
  const rows: AttendanceSheetRow[] = [];
  const scheduledIds = new Set<number>();
  const planCountByAthlete = new Map<number, number>();
  const plannedAthlete = new Map<number, (typeof pairs)[number]['athlete']>();

  for (const p of pairs) {
    scheduledIds.add(p.athleteId);
    planCountByAthlete.set(p.athleteId, (planCountByAthlete.get(p.athleteId) ?? 0) + 1);
    plannedAthlete.set(p.athleteId, p.athlete);
  }

  for (const [athleteId, athlete] of plannedAthlete) {
    const rec = recordByAthlete.get(athleteId);
    rows.push({
      athleteId,
      name: athlete.name,
      sport: athlete.sport,
      position: athlete.position,
      source: 'PLAN',
      planCount: planCountByAthlete.get(athleteId) ?? 1,
      status: (rec?.status as AttendanceStatusCode) ?? null,
      rpe: rec?.rpe ?? null,
      durationMinutes: rec?.durationMinutes ?? null,
      load:
        rec?.rpe != null && rec?.durationMinutes != null
          ? rec.rpe * rec.durationMinutes
          : null,
      notes: rec?.notes ?? null,
    });
  }

  // 手动添加的额外人员（有记录但不在计划名单中）
  const manualIds = records
    .map((r) => r.athleteId)
    .filter((id) => !scheduledIds.has(id));

  if (manualIds.length > 0) {
    const manualAthletes = await prisma.athlete.findMany({
      where: { id: { in: manualIds } },
      select: { id: true, name: true, sport: true, position: true },
    });
    for (const a of manualAthletes) {
      const rec = recordByAthlete.get(a.id)!;
      rows.push({
        athleteId: a.id,
        name: a.name,
        sport: a.sport,
        position: a.position,
        source: 'MANUAL',
        planCount: 0,
        status: (rec.status as AttendanceStatusCode) ?? null,
        rpe: rec.rpe ?? null,
        durationMinutes: rec.durationMinutes ?? null,
        load:
          rec.rpe != null && rec.durationMinutes != null
            ? rec.rpe * rec.durationMinutes
            : null,
        notes: rec.notes ?? null,
      });
    }
  }

  // 4. 可用于手动添加的运动员（尚未在出勤表中的所有运动员）
  const rowsIds = new Set(rows.map((r) => r.athleteId));
  const availableWhere: Record<string, unknown> = {};
  if (rowsIds.size > 0) availableWhere.id = { notIn: Array.from(rowsIds) };
  const allAthletes = await prisma.athlete.findMany({
    where: availableWhere,
    select: { id: true, name: true, sport: true },
    orderBy: { name: 'asc' },
  });

  return { date: dateStr, dayOfWeek, rows, availableAthletes: allAthletes };
}

// ============================================================
// 出勤记录：新增 / 更新
// ============================================================

/** 日期（YYYY-MM-DD）是否为未来日期：按北京时间（Asia/Shanghai，UTC+8）判定 */
function beijingTodayStr(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface UpsertAttendanceInput {
  date: string;
  athleteId: number;
  status: AttendanceStatusCode;
  rpe?: number | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

/**
 * 将出勤表中的负荷数据同步到负荷监控模块（LoadRecord，按天一条）
 * 仅当 RPE 与训练时长均填写时才写入；任一为空则不同步（避免污染负荷监控数据）
 */
async function syncLoadRecordFromAttendance(
  dateStr: string,
  athleteId: number,
  rpe: number | null,
  durationMinutes: number | null,
  operatorId: number
) {
  if (rpe == null || durationMinutes == null) return;
  const recordDate = localMidnight(dateStr);
  const existing = await prisma.loadRecord.findFirst({
    where: { athleteId, recordDate },
  });
  if (existing) {
    await prisma.loadRecord.update({
      where: { id: existing.id },
      data: { rpe, durationMinutes },
    });
  } else {
    await prisma.loadRecord.create({
      data: {
        athleteId,
        recordDate,
        rpe,
        durationMinutes,
        recordedById: operatorId,
      },
    });
  }
}

/** 校验 RPE（1-10 整数，可空）与训练时长（非负整数，可空） */
function validateLoadParams(rpe: number | null | undefined, durationMinutes: number | null | undefined) {
  if (rpe != null) {
    if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
      throw new BusinessError('VALIDATION_ERROR', 'RPE 值必须为 1-10 的整数');
    }
  }
  if (durationMinutes != null) {
    if (!Number.isInteger(durationMinutes) || durationMinutes < 0) {
      throw new BusinessError('VALIDATION_ERROR', '训练时长必须为非负整数（分钟）');
    }
  }
}

export async function upsertAttendanceRecord(
  input: UpsertAttendanceInput,
  operatorId: number
) {
  // 业务规则：出勤状态只能在当天或当天之前标记，禁止对未来日期提前标记
  // （否则「明天有训练计划」的运动员会被错误地提前标记为出勤）
  if (input.date > beijingTodayStr()) {
    throw new BusinessError('VALIDATION_ERROR', '不能为未来日期标记出勤状态，请在训练当天进行标注');
  }

  validateLoadParams(input.rpe, input.durationMinutes);

  const date = parseDateOnly(input.date);

  const athlete = await prisma.athlete.findUnique({ where: { id: input.athleteId } });
  if (!athlete) throw new NotFoundError('运动员不存在');

  const rpe = input.rpe ?? null;
  const durationMinutes = input.durationMinutes ?? null;

  const record = await prisma.attendanceRecord.upsert({
    where: {
      attendanceDate_athleteId: { attendanceDate: date, athleteId: input.athleteId },
    },
    create: {
      attendanceDate: date,
      athleteId: input.athleteId,
      status: input.status,
      rpe,
      durationMinutes,
      notes: input.notes ?? null,
      recordedById: operatorId,
    },
    update: {
      status: input.status,
      rpe,
      durationMinutes,
      notes: input.notes ?? null,
      recordedById: operatorId,
    },
  });

  // 双向关联：同步到负荷监控模块（LoadRecord）
  await syncLoadRecordFromAttendance(input.date, input.athleteId, rpe, durationMinutes, operatorId);

  await logAction({
    userId: operatorId,
    action: 'UPSERT_ATTENDANCE',
    targetType: 'AttendanceRecord',
    targetId: record.id,
    detail: { date: input.date, athleteId: input.athleteId, status: input.status, rpe, durationMinutes },
  });

  return record;
}

// ============================================================
// 出勤记录：删除（重置为未标记 / 移除手动添加）
// ============================================================

export async function deleteAttendanceRecord(
  dateStr: string,
  athleteId: number,
  operatorId: number
) {
  const date = parseDateOnly(dateStr);
  await prisma.attendanceRecord.deleteMany({
    where: { attendanceDate: date, athleteId },
  });

  // 双向关联：重置出勤即清除该运动员当天的负荷监控记录（负荷与出勤按天一一对应）
  await prisma.loadRecord.deleteMany({
    where: { athleteId, recordDate: localMidnight(dateStr) },
  });

  await logAction({
    userId: operatorId,
    action: 'DELETE_ATTENDANCE',
    targetType: 'AttendanceRecord',
    targetId: null,
    detail: { date: dateStr, athleteId },
  });
}

// ============================================================
// 出勤报告
// ============================================================

export async function buildIndividualAttendanceReport(
  athleteId: number,
  startDate: string,
  endDate: string
): Promise<IndividualAttendanceReport> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, name: true, sport: true },
  });
  if (!athlete) throw new NotFoundError('运动员不存在');

  const scheduledMap = await getScheduledDatesMap();
  const scheduledDates = scheduledMap.get(athleteId) ?? new Set<string>();
  const dates = buildDateList(startDate, endDate);

  const planCount = dates.filter((d) => scheduledDates.has(d.dateStr)).length;

  // 计划总份数（同一天多份计划分别计数，与「训练天数」的按天去重区分）
  const totalPlans = await prisma.trainingPlanAthlete.count({
    where: {
      athleteId,
      plan: {
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        startDate: { gte: parseDateOnly(startDate), lt: nextDay(endDate) },
      },
    },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      athleteId,
      attendanceDate: { gte: parseDateOnly(startDate), lt: nextDay(endDate) },
    },
  });

  const statusByDate = new Map<string, string>();
  for (const r of records) statusByDate.set(toDateStr(r.attendanceDate), r.status);

  const schedule: AttendanceScheduleCell[] = dates.map((d) => ({
    date: d.dateStr,
    dayOfWeek: d.dayOfWeek,
    scheduled: scheduledDates.has(d.dateStr),
    status: (statusByDate.get(d.dateStr) as AttendanceStatusCode) ?? null,
  }));

  const statusCounts = aggregateStatus(records);
  const markedCount = records.length;

  return {
    dimension: 'individual',
    athlete,
    range: { startDate, endDate },
    totalPlans,
    planCount,
    markedCount,
    unmarkedCount: Math.max(0, planCount - markedCount),
    statusCounts,
    schedule,
  };
}

export interface AthleteSportOption {
  sport: string;
  count: number;
}

/** 获取当前在册运动员所属的运动项目种类（去重，按中文排序，含人数） */
export async function listAthleteSports(): Promise<AthleteSportOption[]> {
  const groups = await prisma.athlete.groupBy({
    by: ['sport'],
    _count: { _all: true },
  });
  return groups
    .map((g) => ({ sport: g.sport, count: g._count._all }))
    .sort((a, b) => a.sport.localeCompare(b.sport, 'zh-Hans-CN'));
}

export async function buildTeamAttendanceReport(
  startDate: string,
  endDate: string,
  sport?: string
): Promise<TeamAttendanceReport> {
  const scheduledMap = await getScheduledDatesMap();
  const dates = buildDateList(startDate, endDate);

  // 按运动项目过滤：仅统计该项目运动员（与运动员所属项目严格匹配）
  let sportAthleteIds: Set<number> | null = null;
  if (sport) {
    const sportAthletes = await prisma.athlete.findMany({
      where: { sport },
      select: { id: true },
    });
    sportAthleteIds = new Set(sportAthletes.map((a) => a.id));
    if (sportAthleteIds.size === 0) {
      return {
        dimension: 'team',
        range: { startDate, endDate },
        sport: sport ?? null,
        planCount: 0,
        markedCount: 0,
        unmarkedCount: 0,
        statusCounts: aggregateStatus([]),
        members: [],
      };
    }
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      attendanceDate: { gte: parseDateOnly(startDate), lt: nextDay(endDate) },
      ...(sportAthleteIds ? { athleteId: { in: Array.from(sportAthleteIds) } } : {}),
    },
    include: { athlete: { select: { id: true, name: true, sport: true } } },
  });

  // 参与队伍报告的运动员 = 有训练安排 或 有出勤记录（再按项目过滤）
  const athleteIds = new Set<number>();
  for (const id of scheduledMap.keys()) {
    if (sportAthleteIds && !sportAthleteIds.has(id)) continue;
    athleteIds.add(id);
  }
  for (const r of records) athleteIds.add(r.athleteId);

  const athletes = await prisma.athlete.findMany({
    where: { id: { in: Array.from(athleteIds) } },
    select: { id: true, name: true, sport: true },
  });
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  const recordsByAthlete = new Map<number, typeof records>();
  for (const r of records) {
    const arr = recordsByAthlete.get(r.athleteId);
    if (arr) arr.push(r);
    else recordsByAthlete.set(r.athleteId, [r]);
  }

  const members: TeamMemberRow[] = [];
  for (const id of athleteIds) {
    const athlete = athleteMap.get(id);
    if (!athlete) continue;
    const scheduledDates = scheduledMap.get(id) ?? new Set<string>();
    const planCount = dates.filter((d) => scheduledDates.has(d.dateStr)).length;
    const recs = recordsByAthlete.get(id) ?? [];
    members.push({
      athleteId: athlete.id,
      name: athlete.name,
      sport: athlete.sport,
      planCount,
      markedCount: recs.length,
      statusCounts: aggregateStatus(recs),
    });
  }
  members.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  const planCount = members.reduce((s, m) => s + m.planCount, 0);
  const markedCount = members.reduce((s, m) => s + m.markedCount, 0);
  const allStatusCounts = aggregateStatus(records);

  return {
    dimension: 'team',
    range: { startDate, endDate },
    sport: sport ?? null,
    planCount,
    markedCount,
    unmarkedCount: Math.max(0, planCount - markedCount),
    statusCounts: allStatusCounts,
    members,
  };
}
