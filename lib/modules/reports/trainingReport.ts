/**
 * 训练报告聚合服务 —— 报告中心（AMS）
 *
 * 职责：基于训练记录（TrainingRecord / PersonalBest）聚合出统一形态的报告数据，
 * 供 API 层与 PDF 导出复用。数据源字段含义见 prisma/schema.prisma。
 *
 * 支持个人报告（单人）与团队报告（多人）两种作用域，
 * 指标覆盖体能训练核心 KPI 体系：训练负荷、训练强度、负荷分布。
 */

import { prisma } from '@/lib/db/prisma';
import type { ReportData, ReportQuery, ReportScope } from './types';
import { resolveAthleteNames, buildReportTitle } from './reportCommon';

const fmt = (n: number): string => {
  if (!isFinite(n)) return '-';
  return Number(n.toFixed(2)).toString();
};

/** 训练记录明细列 */
const RECORD_COLUMNS = [
  { key: 'date', label: '日期' },
  { key: 'athlete', label: '运动员' },
  { key: 'exercise', label: '训练项目' },
  { key: 'category', label: '分类' },
  { key: 'sets', label: '组数' },
  { key: 'reps', label: '次数' },
  { key: 'load', label: '负荷' },
  { key: 'rpe', label: 'RPE' },
];

const PB_COLUMNS = [
  { key: 'athlete', label: '运动员' },
  { key: 'exercise', label: '训练项目' },
  { key: 'value', label: '成绩' },
  { key: 'date', label: '达成日期' },
];

export async function aggregateTrainingReport(query: ReportQuery): Promise<ReportData> {
  const { athleteIds, exerciseId, startDate, endDate } = query;
  const scope: ReportScope = query.scope ?? 'TEAM';

  const where: Record<string, unknown> = {};
  if (athleteIds && athleteIds.length) where.athleteId = { in: athleteIds };
  if (exerciseId) where.exerciseId = exerciseId;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.trainingDate = dateFilter;
  }

  const records = await prisma.trainingRecord.findMany({
    where,
    include: {
      exercise: { select: { name: true, category: true, unit: true } },
      athlete: { select: { name: true } },
    },
    orderBy: { trainingDate: 'desc' },
  });

  // ---- 概览指标 ----
  const totalSets = records.reduce((s, r) => s + r.actualSets, 0);
  const totalReps = records.reduce((s, r) => s + r.actualReps, 0);
  const totalVolume = records.reduce(
    (s, r) => s + r.actualSets * r.actualReps * (r.actualLoad ?? 0),
    0
  );
  const trainingDays = new Set(
    records.map((r) => r.trainingDate.toISOString().slice(0, 10))
  ).size;
  const avgVolumePerSession = records.length ? totalVolume / records.length : 0;

  const loadValues = records
    .map((r) => r.actualLoad)
    .filter((v): v is number => v != null);
  const avgLoad = loadValues.length
    ? loadValues.reduce((s, v) => s + v, 0) / loadValues.length
    : 0;

  const rpeValues = records.map((r) => r.rpe).filter((v): v is number => v != null);
  const avgRpe = rpeValues.length
    ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length
    : 0;

  // ---- 训练容量趋势（按日汇总）----
  const byDay = new Map<string, number>();
  for (const r of records) {
    const d = r.trainingDate.toISOString().slice(0, 10);
    const v = r.actualSets * r.actualReps * (r.actualLoad ?? 0);
    byDay.set(d, (byDay.get(d) ?? 0) + v);
  }
  const volumeTrend = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, volume]) => ({ date, volume }));

  // ---- 负荷强度趋势（按日平均负荷）----
  const loadByDay = new Map<string, { sum: number; count: number }>();
  for (const r of records) {
    if (r.actualLoad == null) continue;
    const d = r.trainingDate.toISOString().slice(0, 10);
    const cur = loadByDay.get(d) ?? { sum: 0, count: 0 };
    cur.sum += r.actualLoad;
    cur.count += 1;
    loadByDay.set(d, cur);
  }
  const intensityTrend = [...loadByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, load: Number((v.sum / v.count).toFixed(2)) }));

  // ---- RPE 强度分布（1-10 量表）----
  const rpeCounts = new Map<number, number>();
  for (const r of records) {
    if (r.rpe == null) continue;
    rpeCounts.set(r.rpe, (rpeCounts.get(r.rpe) ?? 0) + 1);
  }
  const rpeDistribution = Array.from({ length: 10 }, (_, i) => i + 1).map((level) => ({
    rpe: String(level),
    count: rpeCounts.get(level) ?? 0,
  }));

  // ---- 分类负荷分布（饼图）----
  const byCategory = new Map<string, number>();
  for (const r of records) {
    const cat = r.exercise?.category || '未分类';
    const v = r.actualSets * r.actualReps * (r.actualLoad ?? 0);
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + v);
  }
  const loadByCategory = [...byCategory.entries()].map(([name, value]) => ({ name, value }));

  // ---- 明细表 ----
  const recordRows = records.map((r) => ({
    date: r.trainingDate.toISOString().slice(0, 10),
    athlete: r.athlete.name,
    exercise: r.exercise?.name ?? '未知',
    category: r.exercise?.category ?? '-',
    sets: r.actualSets,
    reps: r.actualReps,
    load: r.actualLoad != null ? `${r.actualLoad} ${r.exercise?.unit ?? ''}`.trim() : '-',
    rpe: r.rpe ?? '-',
  }));

  // ---- PB 列表 ----
  const pbWhere: Record<string, unknown> = {};
  if (athleteIds && athleteIds.length) pbWhere.athleteId = { in: athleteIds };
  const personalBests = await prisma.personalBest.findMany({
    where: pbWhere,
    include: {
      athlete: { select: { name: true } },
      exercise: { select: { name: true, unit: true } },
    },
    orderBy: { value: 'desc' },
    take: 100,
  });
  const pbRows = personalBests.map((pb) => ({
    athlete: pb.athlete.name,
    exercise: pb.exercise?.name ?? '未知',
    value: `${pb.value} ${pb.unit}`,
    date: pb.achievedDate.toISOString().slice(0, 10),
  }));

  const athletes = await resolveAthleteNames(athleteIds);

  return {
    reportType: 'training',
    scope,
    title: buildReportTitle('training', scope, athletes),
    generatedAt: new Date().toISOString(),
    filters: { scope, athleteIds, exerciseId, startDate, endDate },
    athletes,
    kpis: [
      { key: 'totalSessions', label: '训练次数', value: String(records.length), sub: '条记录' },
      { key: 'trainingDays', label: '训练天数', value: String(trainingDays), sub: '去重日期' },
      { key: 'totalVolume', label: '训练总容量', value: fmt(totalVolume), unit: 'kg', sub: '组×次×负荷' },
      { key: 'avgVolumePerSession', label: '平均每次容量', value: fmt(avgVolumePerSession), unit: 'kg', sub: '总容量 ÷ 训练次数' },
      { key: 'totalSets', label: '总组数', value: String(totalSets) },
      { key: 'totalReps', label: '总次数', value: String(totalReps) },
      { key: 'avgLoad', label: '平均负荷', value: fmt(avgLoad), unit: 'kg', sub: '实际负荷均值' },
      { key: 'avgRpe', label: '平均 RPE', value: fmt(avgRpe), sub: '1-10 量表' },
    ],
    charts: [
      { key: 'volumeTrend', label: '训练容量趋势', type: 'bar', xKey: 'date', series: ['volume'], data: volumeTrend },
      { key: 'intensityTrend', label: '负荷强度趋势', type: 'line', xKey: 'date', series: ['load'], data: intensityTrend },
      { key: 'rpeDistribution', label: 'RPE 强度分布', type: 'bar', xKey: 'rpe', series: ['count'], data: rpeDistribution },
      { key: 'loadByCategory', label: '分类负荷分布', type: 'pie', xKey: 'name', series: ['value'], data: loadByCategory },
    ],
    tables: [
      { key: 'records', label: '训练记录明细', columns: RECORD_COLUMNS, rows: recordRows },
      { key: 'personalBests', label: '个人最佳纪录', columns: PB_COLUMNS, rows: pbRows },
    ],
  };
}
