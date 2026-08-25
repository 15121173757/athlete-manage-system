/**
 * 伤病报告聚合服务 —— 报告中心（AMS）
 *
 * 职责：基于伤病记录（Injury / RecoveryPlan）聚合出统一形态的报告数据。
 * 伤病状态沿用 InjuryStatus：INJURED 受伤 / RECOVERING 康复中 / RETURNED 已痊愈。
 */

import { prisma } from '@/lib/db/prisma';
import type { ReportData, ReportQuery, ReportScope } from './types';
import { resolveAthleteNames, buildReportTitle } from './reportCommon';

const fmt = (n: number): string => {
  if (!isFinite(n)) return '-';
  return Number(n.toFixed(2)).toString();
};

const STATUS_LABELS: Record<string, string> = {
  INJURED: '受伤',
  RECOVERING: '康复中',
  RETURNED: '已痊愈',
};

const RECORD_COLUMNS = [
  { key: 'date', label: '受伤日期' },
  { key: 'athlete', label: '运动员' },
  { key: 'type', label: '伤病类型' },
  { key: 'bodyPart', label: '部位' },
  { key: 'status', label: '状态' },
  { key: 'diagnosis', label: '诊断结果' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export async function aggregateInjuryReport(query: ReportQuery): Promise<ReportData> {
  const { athleteIds, status, startDate, endDate } = query;
  const scope: ReportScope = query.scope ?? 'TEAM';

  const where: Record<string, unknown> = {};
  if (athleteIds && athleteIds.length) where.athleteId = { in: athleteIds };
  if (status) where.status = status;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.startDate = dateFilter;
  }

  const injuries = await prisma.injury.findMany({
    where,
    include: { athlete: { select: { name: true } } },
    orderBy: { startDate: 'desc' },
  });

  // ---- 概览指标 ----
  const activeInjuries = injuries.filter(
    (i) => i.status === 'INJURED' || i.status === 'RECOVERING'
  ).length;
  const recovered = injuries.filter((i) => i.status === 'RETURNED');
  const recoveryDays = recovered
    .filter((i) => i.endDate != null)
    .map((i) => (i.endDate!.getTime() - i.startDate.getTime()) / DAY_MS);
  const avgRecoveryDays = recoveryDays.length
    ? recoveryDays.reduce((s, v) => s + v, 0) / recoveryDays.length
    : 0;

  // ---- 部位分布（饼图）----
  const byBodyPart = new Map<string, number>();
  for (const i of injuries) {
    const key = i.bodyPart || '未指定';
    byBodyPart.set(key, (byBodyPart.get(key) ?? 0) + 1);
  }
  const injuryByBodyPart = [...byBodyPart.entries()].map(([name, value]) => ({ name, value }));

  // ---- 类型分布（柱状图）----
  const byType = new Map<string, number>();
  for (const i of injuries) {
    byType.set(i.injuryType, (byType.get(i.injuryType) ?? 0) + 1);
  }
  const injuryByType = [...byType.entries()].map(([name, value]) => ({ name, value }));

  // ---- 明细表 ----
  const rows = injuries.map((i) => ({
    date: i.startDate.toISOString().slice(0, 10),
    athlete: i.athlete.name,
    type: i.injuryType,
    bodyPart: i.bodyPart || '-',
    status: STATUS_LABELS[i.status] ?? i.status,
    diagnosis: i.diagnosis || '-',
  }));

  const athletes = await resolveAthleteNames(athleteIds);

  return {
    reportType: 'injury',
    scope,
    title: buildReportTitle('injury', scope, athletes),
    generatedAt: new Date().toISOString(),
    filters: { scope, athleteIds, status, startDate, endDate },
    athletes,
    kpis: [
      { key: 'totalInjuries', label: '伤病总数', value: String(injuries.length), sub: '条记录' },
      { key: 'activeInjuries', label: '进行中伤病', value: String(activeInjuries), sub: '受伤 / 康复中' },
      { key: 'recovered', label: '已痊愈', value: String(recovered.length) },
      { key: 'avgRecoveryDays', label: '平均恢复天数', value: fmt(avgRecoveryDays), unit: '天', sub: '已痊愈伤病' },
    ],
    charts: [
      { key: 'injuryByBodyPart', label: '伤病部位分布', type: 'pie', xKey: 'name', series: ['value'], data: injuryByBodyPart },
      { key: 'injuryByType', label: '伤病类型分布', type: 'bar', xKey: 'name', series: ['value'], data: injuryByType },
    ],
    tables: [
      { key: 'injuries', label: '伤病记录明细', columns: RECORD_COLUMNS, rows },
    ],
  };
}
